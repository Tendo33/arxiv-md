// QA P1-KA（qa-paddleocr-15fe0f9-2026-10-29.md）：popup / abs 按钮走 CONVERT_PAPER → converter 在 SW 里直接建任务，
// 以前只调 processMinerUTaskInBackground、不挂 keepAlive alarm，SW 被停后卡在 28%。
// 现在所有发起入口都走 startParseTask（处理 + refreshKeepAlive）。逐个入口断言。
import fs from 'fs';
import path from 'path';

const rd = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const bg = rd('src/background/index.js');
const conv = rd('src/core/converter/index.js');
const caseBody = (name) => { const i = bg.indexOf(`case '${name}'`); return bg.slice(i, bg.indexOf('case ', i + 6)); };
const fnBody = (name) => { const i = bg.indexOf(`function ${name}(`); return bg.slice(i, bg.indexOf('\n}\n', i)); };

describe('每个发起入口都走 startParseTask', () => {
  test('converter（CONVERT_PAPER：popup 按钮 / abs 按钮 / 快捷键 / 右键）', () => {
    expect(conv).toMatch(/backgroundModule\.startParseTask\(task\.id\)/);
    expect(conv).not.toMatch(/backgroundModule\.processMinerUTaskInBackground\(/);
  });
  test('START_PDF_TASK / START_MINERU_TASK / START_MINERU_TASK_FORCE → _doStartPdfTask', () => {
    expect(caseBody('START_PDF_TASK')).toMatch(/_doStartPdfTask\(/);
    expect(fnBody('handleStartMinerUTask')).toMatch(/_doStartMinerUTask\(/);
    expect(bg).toMatch(/const task = await taskManager\.addTask\([^)]*\);[\s\S]{0,400}startParseTask\(task\.id\)/);
  });
  test('RETRY_TASK', () => expect(fnBody('handleRetryTask')).toMatch(/startParseTask\(taskId\)/));
  test('_INTERNAL_PROCESS_TASK', () => expect(caseBody('_INTERNAL_PROCESS_TASK')).toMatch(/startParseTask\(message\.taskId\)/));
  test('index.js 里 processMinerUTaskInBackground 只在 startParseTask 内被调用', () => {
    const calls = bg.match(/processMinerUTaskInBackground\(/g) || [];
    expect(calls).toHaveLength(1);
    expect(fnBody('startParseTask')).toMatch(/processMinerUTaskInBackground\(taskId\);\s*return refreshKeepAlive\(\);/);
  });
  test('addTask 只有这两个调用点（新入口要补进上面的断言）', () => {
    const all = ['src/background/index.js', 'src/core/converter/index.js'].map((f) => (rd(f).match(/taskManager\.addTask\(/g) || []).length);
    expect(all).toEqual([1, 1]);
  });
});

test('startParseTask：有 pending 任务时创建 keepAlive alarm（行为）', async () => {
  const ev = () => ({ addListener: () => {} });
  const create = jest.fn(async () => {});
  global.chrome = {
    runtime: { id: 'me', onMessage: ev(), onInstalled: ev(), onStartup: ev(), getURL: (p) => p, sendMessage: () => Promise.resolve(), getManifest: () => ({ version: '0' }) },
    action: { setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {} },
    tabs: { onUpdated: ev(), onRemoved: ev(), query: async () => [] },
    commands: { onCommand: ev() },
    alarms: { onAlarm: ev(), create, clear: async () => true, get: async () => null },
    storage: { local: { get: async () => ({}), set: async () => {} }, sync: { get: async () => ({}), set: async () => {} }, onChanged: ev() },
    notifications: { onClicked: ev(), create: () => {} },
  };
  let mod; const proc = jest.fn();
  jest.isolateModules(() => {
    jest.doMock('../src/background/mineru-task-runner', () => ({ ...jest.requireActual('../src/background/mineru-task-runner'), processMinerUTaskInBackground: proc }));
    mod = require('../src/background/index.js');
    const tm = require('../src/core/task-manager').default;
    jest.spyOn(tm, 'getStatistics').mockResolvedValue({ pending: 1, processing: 0 });
  });
  await mod.startParseTask('t1');
  expect(proc).toHaveBeenCalledWith('t1');
  expect(create).toHaveBeenCalledWith('keepAlive', expect.objectContaining({ periodInMinutes: expect.any(Number) }));
});
