// R4-18：alarms / permissions / storage(local+sync) / onChanged 的 chrome 桩
export function createStorageArea(name, initial = {}, emit) {
  let data = JSON.parse(JSON.stringify(initial));
  const pick = (keys) => {
    if (keys == null) return { ...data };
    if (typeof keys === 'string') return keys in data ? { [keys]: data[keys] } : {};
    if (Array.isArray(keys)) return Object.fromEntries(keys.filter((k) => k in data).map((k) => [k, data[k]]));
    return Object.fromEntries(Object.entries(keys).map(([k, d]) => [k, k in data ? data[k] : d]));
  };
  const area = {
    get: jest.fn(async (keys, cb) => { const r = pick(keys); if (cb) cb(r); return r; }),
    set: jest.fn(async (obj, cb) => {
      const changes = {};
      for (const [k, v] of Object.entries(obj)) { changes[k] = { oldValue: data[k], newValue: v }; data[k] = JSON.parse(JSON.stringify(v)); }
      if (emit) emit(changes, name);
      if (cb) cb();
    }),
    remove: jest.fn(async (keys, cb) => {
      const changes = {};
      for (const k of [].concat(keys)) if (k in data) { changes[k] = { oldValue: data[k] }; delete data[k]; }
      if (emit && Object.keys(changes).length) emit(changes, name);
      if (cb) cb();
    }),
    clear: jest.fn(async () => { data = {}; }),
    dump: () => JSON.parse(JSON.stringify(data)),
  };
  return area;
}

export function createEvent() {
  const fns = [];
  return { addListener: (f) => fns.push(f), removeListener: (f) => { const i = fns.indexOf(f); if (i >= 0) fns.splice(i, 1); }, hasListener: (f) => fns.includes(f), fire: (...a) => Promise.all(fns.map((f) => f(...a))), listeners: fns };
}

export function createAlarms() {
  const map = new Map(); const onAlarm = createEvent();
  return {
    onAlarm,
    create: jest.fn(async (name, info) => { map.set(name, { name, ...info }); }),
    get: jest.fn(async (name) => map.get(name) || undefined),
    getAll: jest.fn(async () => [...map.values()]),
    clear: jest.fn(async (name) => map.delete(name)),
    fireAlarm: (name) => onAlarm.fire({ name }),
  };
}

/** granted: 已授予的 origins/permissions；answer: request() 的用户选择（true=同意） */
export function createPermissions({ origins = [], permissions = [], answer = true } = {}) {
  const state = { origins: new Set(origins), permissions: new Set(permissions), answer };
  const has = (q) => (q.origins || []).every((o) => state.origins.has(o)) && (q.permissions || []).every((p) => state.permissions.has(p));
  return {
    state,
    contains: jest.fn(async (q) => has(q)),
    request: jest.fn(async (q) => {
      if (!state.answer) return false;
      (q.origins || []).forEach((o) => state.origins.add(o)); (q.permissions || []).forEach((p) => state.permissions.add(p));
      return true;
    }),
    remove: jest.fn(async (q) => { (q.origins || []).forEach((o) => state.origins.delete(o)); (q.permissions || []).forEach((p) => state.permissions.delete(p)); return true; }),
    getAll: jest.fn(async () => ({ origins: [...state.origins], permissions: [...state.permissions] })),
  };
}

export function installChrome({ local = {}, sync = {}, ...perm } = {}) {
  const onChanged = createEvent();
  const emit = (changes, area) => onChanged.fire(changes, area);
  const chrome = {
    storage: { local: createStorageArea('local', local, emit), sync: createStorageArea('sync', sync, emit), onChanged },
    alarms: createAlarms(),
    permissions: createPermissions(perm),
    runtime: { id: 'test', lastError: null, getURL: (p) => `chrome-extension://test/${p}`, onMessage: createEvent(), sendMessage: jest.fn(async () => ({})) },
    downloads: { download: jest.fn((opts, cb) => { if (cb) cb(1); return Promise.resolve(1); }) },
    notifications: { create: jest.fn((id, o, cb) => cb && cb(id)), onClicked: createEvent() },
    i18n: { getUILanguage: () => 'zh-CN' },
  };
  global.chrome = chrome;
  return chrome;
}
