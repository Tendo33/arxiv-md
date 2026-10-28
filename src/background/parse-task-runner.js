// R4-11：通用 PDF 解析任务执行器（替代 mineru-task-runner 的 MinerU 专用实现）
// - 异步 provider：submit → 把 jobId/startedAt 落盘 → 按 pollIntervalMs 轮询，截止时间 = startedAt + provider.timeoutMs
// - 同步 provider：不进轮询，直接 await，60s 超时
// - 失败只记录统一错误码，绝不自动换到另一个 provider（R4-16）
// - jobId 落盘后，SW 被杀也能按 jobId 续上轮询（R4-12 resume）
import { ParseError, isParseError } from '@pdf-core/errors';
import { normalizeMarkdown, shouldNormalize } from '@pdf-core/normalize/index';
import { ensureProviderPermission } from '@pdf-core/permissions';
import { TASK_STATUS } from '@config/constants';

export const SYNC_PROVIDER_TIMEOUT_MS = 60 * 1000;
export const DEFAULT_ASYNC_TIMEOUT_MS = 10 * 60 * 1000;

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

  async function fail(task, err, provider) {
    const e = isParseError(err) ? err : (provider && provider.mapError ? provider.mapError(err) : new ParseError('PROVIDER_FAILED', { raw: err }));
    await taskManager.updateTask(task.id, {
      status: TASK_STATUS.FAILED,
      error: e.message || e.code,
      errorCode: e.code,
      errorReason: e.reason || null,
      errorHttpStatus: e.httpStatus || null,
    });
    notify(task, 'failed', e.message || e.code, provider);
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
    const includeMeta = storage.getIncludeMetadata ? (await storage.getIncludeMetadata()) !== false : true;
    const norm = normalizeMarkdown(fetched.markdown || '', { meta: includeMeta ? { ...meta, source: provider.id } : null });
    const base = makeFilename(meta, 'md').replace(/\.md$/, '');
    const saved = await saveDeliverable(norm, base);
    return { downloadId: saved.id, filename: saved.filename, resultUrl: fetched.markdownUrl || null };
  }

  async function runAsync(task, provider, creds) {
    let { jobId, startedAt } = task;
    const ctx = {};
    if (!jobId) {
      const r = await provider.submit({ url: pdfUrlOf(task), dataId: task.paperInfo && task.paperInfo.arxivId }, creds, ctx);
      jobId = r.jobId; startedAt = now();
      await taskManager.updateTask(task.id, { jobId, startedAt, progress: 10 });
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
      const key = await storage.getProviderKey(provider.id);
      if (!key) return { error: await fail(task, new ParseError('AUTH_INVALID', { provider: provider.id }), provider) };
      // R4-08：缺域名权限 → 不发任何请求，任务失败为 PERMISSION_MISSING（UI 显示“去设置授权”）
      if (deps.permissions) {
        try { await ensureProviderPermission(deps.permissions, provider); } catch (e) { return { error: await fail(task, e, provider) }; }
      }
      const creds = { token: key };
      await taskManager.updateTask(taskId, { status: TASK_STATUS.PROCESSING, ...(task.jobId ? {} : { progress: 0 }) });
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
        log.error('Parse task failed:', taskId, err);
        return { error: await fail(task, err, provider) };
      }
    } finally {
      running.delete(taskId);
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

  return { process, resumeActiveTasks, isRunning: (id) => running.has(id) };
}

export function pdfUrlOf(task) {
  const p = task.paperInfo || {};
  return p.pdfUrl || `https://arxiv.org/pdf/${p.arxivId}.pdf`;
}
