// R4-11：通用 PDF 解析任务执行器（替代 mineru-task-runner 的 MinerU 专用实现）
// - 异步 provider：submit → 把 jobId/startedAt 落盘 → 按 pollIntervalMs 轮询，截止时间 = startedAt + provider.timeoutMs
// - 同步 provider：不进轮询，直接 await，60s 超时
// - 失败只记录统一错误码，绝不自动换到另一个 provider（R4-16）
// - jobId 落盘后，SW 被杀也能按 jobId 续上轮询（R4-12 resume）
import { ParseError, isParseError, ERROR_REASONS } from '@pdf-core/errors';
import { normalizeMarkdown, shouldNormalize } from '@pdf-core/normalize/index';
import { buildMineruLayout } from '@pdf-core/output/mineru-layout';
import { assertSavableMarkdown } from '@pdf-core/output/pre-save';
import { TASK_STATUS } from '@config/constants';
import { pdfUrlOf } from './pdf-url';

export const SYNC_PROVIDER_TIMEOUT_MS = 60 * 1000;
export const DEFAULT_ASYNC_TIMEOUT_MS = 10 * 60 * 1000;
/** QA L-01：DNR 没就绪时最多等多久（等扩展页面关掉再重载） */
export const DNR_REINIT_MAX_WAIT_MS = 10 * 60 * 1000;

const sleepReal = (ms) => new Promise((r) => setTimeout(r, ms));

function withTimeout(promise, ms, provider) {
  let t;
  return Promise.race([
    promise,
    new Promise((_, rej) => { t = setTimeout(() => rej(new ParseError('TIMEOUT', { provider })), ms); }),
  ]).finally(() => clearTimeout(t));
}

/**
 * @param {object} deps
 * @param {{get:(id:string)=>object|undefined}} deps.registry
 * @param {object} deps.taskManager  getTask/updateTask
 * @param {{getProviderKey:(id:string)=>Promise<string|null>, incrementConversion?:Function, getIncludeMetadata?:Function}} deps.storage
 * @param {{consume:(id:string)=>Promise<boolean>}} deps.guard   deletedTaskGuard
 * @param {(url:string, filename:string)=>Promise<number>} deps.downloadUrl  原始 ZIP 下载（MinerU）
 * @param {(result:object, baseName:string)=>Promise<{id:number, filename:string}>} deps.saveDeliverable  整理后交付
 * @param {(base:object, ext:string)=>string} deps.makeFilename
 * @param {(task:object, status:'completed'|'failed', detail:string, provider?:object)=>void} [deps.notify]
 * @param {{normalizeMinerU?:boolean}} [deps.options]
 */
export function createParseTaskRunner(deps) {
  const { registry, taskManager, storage, guard, downloadUrl, saveDeliverable, makeFilename, notify = () => {}, now = () => Date.now(), sleep = sleepReal, log = { info() {}, error() {} }, options = {} } = deps;
  const running = new Set();
  const controllers = new Map(); // 审查 P2-3：每个任务一个 AbortController，删除时中止发送/轮询

  async function fail(task, err, provider) {
    const e = isParseError(err) ? err : (provider && provider.mapError ? provider.mapError(err) : new ParseError('PROVIDER_FAILED', { raw: err }));
    await taskManager.updateTask(task.id, {
      status: TASK_STATUS.FAILED,
      error: e.message || e.code,
      errorCode: e.code,
      errorReason: e.reason || null,
      errorHttpStatus: e.httpStatus || null,
      errorHost: e.host || null,
    });
    // rp2：界面文案不再出现 HTTP 状态码，状态码只进日志（和任务记录 errorHttpStatus）
    try { log.error(`PDF parse task ${task.id} failed: ${e.code}${e.reason ? ` (${e.reason})` : ''}${e.httpStatus ? ` HTTP ${e.httpStatus}` : ''}`); } catch { /* 日志失败不影响任务 */ }
    notify(task, 'failed', e, provider); // 通知层按 code/reason 选文案，不展示 e.message
    return e;
  }

  async function deliver(task, provider, fetched) {
    const p = task.paperInfo || {};
    const meta = { title: p.title, authors: p.authors, year: p.year, arxivId: p.arxivId };
    if (fetched.zipUrl && !shouldNormalize(provider, options)) {
      const filename = makeFilename(meta, 'zip');
      const downloadId = await downloadUrl(fetched.zipUrl, filename);
      return { zipUrl: fetched.zipUrl, downloadId, filename };
    }
    // AR-02：PDF 解析结果没有正文 → 任务失败（empty_result），不写空文件、不报「完成」
    assertSavableMarkdown(fetched.markdown, { provider: provider.id });
    const includeMeta = storage.getIncludeMetadata ? (await storage.getIncludeMetadata()) !== false : true;
    const fmMeta = includeMeta ? { ...meta, source: provider.id } : null;
    // PaddleOCR：和 MinerU 一样交付 ZIP（full.md + images/<sha256>）；旧 markdownUrl 结果没有图片列表，走原流程
    const norm = provider.layout === 'mineru' && Array.isArray(fetched.images) && fetched.jsonUrl
      ? await buildMineruLayout(fetched, { meta: fmMeta })
      : normalizeMarkdown(fetched.markdown || '', { meta: fmMeta });
    if (norm.failedImages && norm.failedImages.length) {
      try { log.error(`PDF parse task ${task.id}: ${norm.failedImages.length} image(s) failed to download`); } catch { /* noop */ }
    }
    const base = makeFilename(meta, 'md').replace(/\.md$/, '');
    const saved = await saveDeliverable(norm, base);
    return { downloadId: saved.id, filename: saved.filename, resultUrl: fetched.markdownUrl || null };
  }

  async function runAsync(task, provider, creds) {
    let { jobId, startedAt } = task;
    const ctrl = controllers.get(task.id);
    const ctx = ctrl ? { signal: ctrl.signal } : {};
    if (!jobId) {
      // 先落盘「正在提交」：SW 在拿到 jobId 前被回收时，resume 不再静默重传（见 process）
      // QA L-06：提交阶段可能要 ~100 s；从提交开始就计时并给 5%，卡片不再停在 0%
      const submitAt = now();
      await taskManager.updateTask(task.id, { submitStartedAt: submitAt, startedAt: submitAt, progress: 5 });
      const r = await provider.submit({ url: pdfUrlOf(task), dataId: task.paperInfo && task.paperInfo.arxivId }, creds, ctx);
      // 发送途中用户删了任务：服务端可能已建任务，但不再落盘 jobId、不轮询
      if ((ctrl && ctrl.signal.aborted) || (await guard.consume(task.id))) return { deleted: true };
      jobId = r.jobId; startedAt = submitAt;
      await taskManager.updateTask(task.id, { jobId, startedAt, progress: 10, submitStartedAt: null });
    }
    const deadline = (startedAt ?? now()) + (provider.timeoutMs || DEFAULT_ASYNC_TIMEOUT_MS);
    for (;;) {
      if (await guard.consume(task.id)) return { deleted: true };
      const s = await provider.poll(jobId, creds, ctx);
      if (s.state === 'done') return { result: await provider.fetchResult(s.result, creds, ctx), jobId };
      if (s.state === 'failed') throw new ParseError('PROVIDER_FAILED', { provider: provider.id, raw: s.raw, reason: s.error });
      if (s.progress && s.progress.total) {
        await taskManager.updateTask(task.id, { progress: Math.round(10 + (s.progress.done / s.progress.total) * 80) });
      }
      if (now() >= deadline) throw new ParseError('TIMEOUT', { provider: provider.id });
      await sleep(provider.pollIntervalMs || 2000);
    }
  }

  async function runSync(task, provider, creds) {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const ctx = ctrl ? { signal: ctrl.signal } : {};
    try {
      const r = await withTimeout(provider.submit({ url: pdfUrlOf(task), dataId: task.paperInfo && task.paperInfo.arxivId }, creds, ctx), SYNC_PROVIDER_TIMEOUT_MS, provider.id);
      return { result: r.result || r };
    } finally { if (ctrl) ctrl.abort(); }
  }

  /** 处理一个任务；同一个任务同时只跑一份（resume 和新建不会重复轮询） */
  async function process(taskId) {
    if (running.has(taskId)) return { skipped: 'running' };
    running.add(taskId);
    try {
      if (await guard.consume(taskId)) return { skipped: 'deleted' };
      const task = await taskManager.getTask(taskId);
      if (!task) return { skipped: 'missing' };
      const provider = registry.get(task.provider || 'mineru');
      if (!provider) return { error: await fail(task, new ParseError('PROVIDER_FAILED', { reason: `unknown provider ${task.provider}` })) };
      // 1.2.2：使用时零确认——不再有数据说明确认和非 OA 确认，有 Key 就直接解析
      const key = await storage.getProviderKey(provider.id);
      if (!key) {
        // 复审 P2-A：Key 不跨设备同步。后端是选过的（sync 带过来）但本设备没有 Key → 明确提示在本设备重新填写
        const chosen = storage.getChosenPdfProvider ? await storage.getChosenPdfProvider().catch(() => null) : null;
        const info = chosen === provider.id
          ? { provider: provider.id, reason: ERROR_REASONS.KEY_NOT_ON_DEVICE }  // 文案由 UI 按 reason 走 i18n（err_reason_key_not_on_device）
          : { provider: provider.id };
        return { error: await fail(task, new ParseError('AUTH_INVALID', info), provider) };
      }
      const creds = { token: key };
      // R4-02：首次提交前（还没有 jobId）让 background 确认该 provider 需要的网络规则已就绪（幂等）
      if (deps.beforeSubmit && !task.jobId) {
        // R5-01：不再吞掉错误继续提交（规则没装好提交必然 403 / 卡住），直接让任务失败并给可读原因
        try { await deps.beforeSubmit(provider); } catch (e) {
          // QA L-01：DNR 调用一直挂起时（见 dnr-reinit.js）只能重新载入扩展才恢复。
          // 任务保持 PENDING，排队等「没有扩展页面开着、没有别的任务在跑」时重载一次（不在用户眼前关掉设置页 / popup），
          // 重载后 resume 续跑。每个任务最多重载一次；最多等 DNR_REINIT_MAX_WAIT_MS，超时照常失败
          if (e && e.reason === ERROR_REASONS.DNR_NOT_READY && typeof deps.reinit === 'function' && !task.dnrAutoReinit) {
            const since = task.dnrReinitWaitSince ?? now();
            if (now() - since < DNR_REINIT_MAX_WAIT_MS) {
              await taskManager.updateTask(taskId, { status: TASK_STATUS.PENDING, dnrReinitWaitSince: since, error: null, errorCode: null, errorReason: null });
              try { log.info(`PDF parse task ${taskId}: DNR not ready, reload queued until no extension page is open`); } catch { /* noop */ }
              deps.reinit({ isIdle: () => running.size === 0, beforeReload: () => taskManager.updateTask(taskId, { dnrAutoReinit: true }) });
              return { reinit: true };
            }
          }
          return { error: await fail(task, e, provider) };
        }
      }
      // 审查 P2-3：上次提交途中后台被回收、没拿到 jobId → 明确报错，让用户手动重试，不自动重传
      if (provider.mode !== 'sync' && !task.jobId && task.submitStartedAt) {
        return { error: await fail(task, new ParseError('NETWORK', { provider: provider.id, reason: ERROR_REASONS.INTERRUPTED_SUBMIT }), provider) };
      }
      // 审查 P3-4：开始处理就不再是「等 DNR 重载」，清掉 dnrReinitWaitSince（dnrAutoReinit 保留：每个任务最多自动重载一次）
      await taskManager.updateTask(taskId, { status: TASK_STATUS.PROCESSING, dnrReinitWaitSince: null, ...(task.jobId ? {} : { progress: 0 }) });
      const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      if (ctrl) controllers.set(taskId, ctrl);
      try {
        const out = provider.mode === 'sync' ? await runSync(task, provider, creds) : await runAsync(task, provider, creds);
        if (out.deleted || (await guard.consume(taskId))) return { skipped: 'deleted' };
        const delivered = await deliver(task, provider, out.result);
        await taskManager.updateTask(taskId, {
          status: TASK_STATUS.COMPLETED, progress: 100, completedAt: now(),
          ...delivered, ...(out.jobId ? { taskId: out.jobId } : {}),
        });
        if (storage.incrementConversion) await storage.incrementConversion(provider.id === 'mineru' ? 'mineru_api' : `${provider.id}_api`);
        notify(task, 'completed', delivered.zipUrl || delivered.filename, provider);
        return { completed: true };
      } catch (err) {
        if ((ctrl && ctrl.signal.aborted) || (err && err.callerAborted)) { await guard.consume(taskId); return { skipped: 'deleted' }; }
        log.error('Parse task failed:', taskId, err);
        return { error: await fail(task, err, provider) };
      }
    } finally {
      running.delete(taskId);
      controllers.delete(taskId);
    }
  }

  /**
   * R4-12：SW 重启 / keepAlive alarm 唤醒时调用。对 pending/processing 且本 SW 里没在跑的任务：
   * 有 jobId → 按 jobId 续上轮询（不会重新提交）；没有 jobId → 正常提交
   * @returns {Promise<string[]>} 本次续上的任务 id
   */
  async function resumeActiveTasks() {
    const tasks = await taskManager.getTasks();
    const ids = tasks
      .filter((t) => (t.status === TASK_STATUS.PENDING || t.status === TASK_STATUS.PROCESSING) && !running.has(t.id))
      .map((t) => t.id);
    ids.forEach((id) => { process(id).catch((e) => log.error('resume failed', id, e)); });
    return ids;
  }

  /** 用户删除任务：立即中止进行中的发送/轮询（删除标记由调用方先落盘） */
  function abort(taskId) {
    const c = controllers.get(taskId);
    if (!c) return false;
    c.abort(); return true;
  }

  return { process, resumeActiveTasks, abort, isRunning: (id) => running.has(id) };
}

export { pdfUrlOf };
