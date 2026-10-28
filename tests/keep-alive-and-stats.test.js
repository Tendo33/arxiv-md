import { KEEP_ALIVE_ALARM, syncKeepAlive } from '../src/background/keep-alive';
import { resolveTotalConversions } from '../src/ui/popup/popup-stats';

function fakeAlarms() {
  const alarms = new Map();
  return {
    alarms,
    async get(name) { return alarms.get(name); },
    async create(name, info) { alarms.set(name, info); },
    async clear(name) { return alarms.delete(name); },
  };
}

describe('keep-alive alarm', () => {
  test('creates the alarm only while tasks are active and clears it when idle', async () => {
    const api = fakeAlarms();
    expect(await syncKeepAlive(api, { pending: 0, processing: 0 })).toBe(false);
    expect(api.alarms.has(KEEP_ALIVE_ALARM)).toBe(false);

    expect(await syncKeepAlive(api, { pending: 1, processing: 0 })).toBe(true);
    expect(api.alarms.has(KEEP_ALIVE_ALARM)).toBe(true);

    expect(await syncKeepAlive(api, { pending: 0, processing: 0, completed: 3 })).toBe(false);
    expect(api.alarms.has(KEEP_ALIVE_ALARM)).toBe(false);
  });
});

describe('popup total conversions', () => {
  test('prefers the global conversion counter', () => {
    expect(resolveTotalConversions({ total: 0 }, { totalConversions: 2 })).toBe(2);
  });
  test('falls back to task count when statistics are unavailable', () => {
    expect(resolveTotalConversions({ total: 1 }, null)).toBe(1);
    expect(resolveTotalConversions(undefined, undefined)).toBe(0);
  });
});
