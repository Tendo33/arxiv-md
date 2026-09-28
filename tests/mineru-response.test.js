import { isMinerUSuccessCode, readMinerUTaskStatus } from '../src/core/mineru-response';

describe('MinerU responses', () => {
  test('treats numeric and string zero as success', () => {
    expect(isMinerUSuccessCode(0)).toBe(true);
    expect(isMinerUSuccessCode('0')).toBe(true);
    expect(isMinerUSuccessCode(1)).toBe(false);
    expect(isMinerUSuccessCode('failed')).toBe(false);
  });

  test('reads the v4 extract_result envelope', () => {
    expect(readMinerUTaskStatus({
      task_id: 'task-1',
      extract_result: {
        state: 'done',
        full_zip_url: 'https://cdn.example/result.zip',
        extract_progress: { extracted_pages: 2, total_pages: 2 },
      },
    })).toEqual({
      taskId: 'task-1',
      state: 'done',
      progress: { extracted_pages: 2, total_pages: 2 },
      zipUrl: 'https://cdn.example/result.zip',
      error: null,
    });
  });

  test('falls back to flat fields and reports a missing zip explicitly', () => {
    expect(readMinerUTaskStatus({
      task_id: 'task-2',
      state: 'done',
      err_msg: null,
    })).toMatchObject({
      taskId: 'task-2',
      state: 'done',
      zipUrl: null,
    });
  });
});
