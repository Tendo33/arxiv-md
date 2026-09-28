import { createDeletedTaskGuard } from '../src/core/deleted-task-guard';

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    async get(key) {
      return { [key]: data[key] };
    },
    async set(values) {
      Object.assign(data, values);
    },
  };
}

describe('deleted task guard', () => {
  test('remembers a deleted id after the in-memory set is gone', async () => {
    const storage = memoryStorage();
    const firstWorker = createDeletedTaskGuard(storage);
    await firstWorker.mark('task-1');

    const restartedWorker = createDeletedTaskGuard(storage);
    expect(await restartedWorker.has('task-1')).toBe(true);
    expect(await restartedWorker.consume('task-1')).toBe(true);
    expect(await restartedWorker.has('task-1')).toBe(false);
  });

  test('consume is a no-op for an unknown id', async () => {
    const guard = createDeletedTaskGuard(memoryStorage());
    expect(await guard.consume('missing')).toBe(false);
  });
});
