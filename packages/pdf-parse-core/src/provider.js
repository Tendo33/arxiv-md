// R4-02：Provider 接口（JSDoc 类型 + 运行时校验）

/**
 * @typedef {'pending'|'running'|'done'|'failed'} UnifiedState
 *
 * @typedef {Object} SubmitInput
 * @property {string} [url]   公开 PDF 的 URL（优先，不上传文件）
 * @property {Blob}   [blob]  本地 PDF（本轮各 provider 都不用）
 * @property {string} [dataId]
 * @property {Object} [options]
 *
 * @typedef {Object} PollResult
 * @property {UnifiedState} state
 * @property {{done:number,total:number}|null} [progress]  页数进度
 * @property {Object} [result]   state=done 时 provider 自定的结果描述（如 zipUrl / markdownUrl）
 * @property {string} [error]
 *
 * @typedef {Object} Provider
 * @property {string} id
 * @property {string} label
 * @property {string[]} hosts              需要的 host 权限（match pattern）
 * @property {Array<{key:string,label:string,secret?:boolean}>} credentialFields
 * @property {'sync'|'async'} mode
 * @property {'url'|'blob'|'both'} input
 * @property {'free'|'paid'|'local'} cost
 * @property {number} [timeoutMs]          整个任务的超时上限
 * @property {(input:SubmitInput, creds:Object, ctx:Object) => Promise<{jobId?:string, result?:Object}>} submit
 * @property {(jobId:string, creds:Object, ctx:Object) => Promise<PollResult>} [poll]
 * @property {(result:Object, creds:Object, ctx:Object) => Promise<Object>} [fetchResult]
 * @property {(err:any) => import('./errors').ParseError} mapError
 * @property {(creds:Object, ctx:Object) => Promise<{ok:boolean, error?:any}>} [testConnection]
 */

export const PROVIDER_MODES = ['sync', 'async'];
export const PROVIDER_INPUTS = ['url', 'blob', 'both'];
export const PROVIDER_COSTS = ['free', 'paid', 'local'];
export const UNIFIED_STATES = ['pending', 'running', 'done', 'failed'];

/** 校验 provider 形状，不合法抛 TypeError；返回冻结后的 provider */
export function defineProvider(p) {
  const fail = (m) => { throw new TypeError(`Invalid provider${p && p.id ? ` "${p.id}"` : ''}: ${m}`); };
  if (!p || typeof p !== 'object') fail('not an object');
  if (typeof p.id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(p.id)) fail('id');
  if (typeof p.label !== 'string' || !p.label) fail('label');
  if (!Array.isArray(p.hosts)) fail('hosts[]');
  if (!Array.isArray(p.credentialFields)) fail('credentialFields[]');
  if (!PROVIDER_MODES.includes(p.mode)) fail('mode');
  if (!PROVIDER_INPUTS.includes(p.input)) fail('input');
  if (!PROVIDER_COSTS.includes(p.cost)) fail('cost');
  if (typeof p.submit !== 'function') fail('submit()');
  if (typeof p.mapError !== 'function') fail('mapError()');
  if (p.mode === 'async' && typeof p.poll !== 'function') fail('async provider needs poll()');
  return Object.freeze({ ...p });
}
