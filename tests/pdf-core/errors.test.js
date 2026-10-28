// R4-03：9 类统一错误码 + 中英文案 + HTTP 分类（403 空 body / 401 / 额度 要能区分）
import { translations } from '@config/locales';
import { ERROR_MESSAGES, LEGACY_MINERU_ERROR_CODES, LEGACY_MINERU_ERROR_TEXT } from '@config/constants';
import {
  ALL_ERROR_CODES, ERROR_ACTIONS, ParseError, isParseError, fromJSON, fromFetchFailure,
  classifyHttpError, readErrorResponse, formatParseError, ERROR_REASONS,
} from '@pdf-core/errors';

const CODES = ['AUTH_INVALID', 'QUOTA_EXCEEDED', 'RATE_LIMITED', 'FILE_UNSUPPORTED', 'TOO_LARGE', 'NETWORK', 'PERMISSION_MISSING', 'TIMEOUT', 'PROVIDER_FAILED'];

describe('错误码表', () => {
  test('正好 9 个码', () => expect([...ALL_ERROR_CODES].sort()).toEqual([...CODES].sort()));
  test.each(CODES)('%s 在 zh/en 都有文案和下一步动作', (code) => {
    for (const lang of ['zh', 'en']) {
      const t = translations[lang];
      expect(typeof t[`err_${code}`]).toBe('string');
      expect(t[`err_${code}`].length).toBeGreaterThan(3);
      expect(ERROR_ACTIONS[code].length).toBeGreaterThan(0);
      for (const a of ERROR_ACTIONS[code]) expect(t[`err_action_${a}`]).toBeTruthy();
    }
  });
  test.each(CODES.filter((c) => c !== 'RATE_LIMITED'))('%s 文案带后端名占位', (code) => {
    expect(translations.zh[`err_${code}`]).toContain('{provider}');
    expect(translations.en[`err_${code}`]).toContain('{provider}');
  });
  test('PERMISSION_MISSING 带域名占位', () => {
    expect(translations.zh.err_PERMISSION_MISSING).toContain('{host}');
    expect(translations.en.err_PERMISSION_MISSING).toContain('{host}');
  });
  test('“换后端”只是动作 id，不自动切换（只给 switch，由 UI 跳设置页）', () => {
    expect(ERROR_ACTIONS.QUOTA_EXCEEDED).toEqual(['switch']);
  });
});

describe('ParseError', () => {
  test('字段 code/provider/httpStatus/raw', () => {
    const e = new ParseError('AUTH_INVALID', { provider: 'paddleocr', httpStatus: 401, raw: { a: 1 } });
    expect(e).toBeInstanceOf(Error);
    expect([e.code, e.provider, e.httpStatus, e.raw]).toEqual(['AUTH_INVALID', 'paddleocr', 401, { a: 1 }]);
    expect(isParseError(e)).toBe(true);
    expect(e.actions).toEqual(['settings']);
  });
  test('未知码抛错', () => expect(() => new ParseError('NOPE')).toThrow(TypeError));
  test('toJSON / fromJSON 往返', () => {
    const e = new ParseError('TIMEOUT', { provider: 'mineru' });
    const back = fromJSON(JSON.parse(JSON.stringify(e)));
    expect(back.code).toBe('TIMEOUT');
    expect(back.provider).toBe('mineru');
    expect(fromJSON({ code: 'X' })).toBeNull();
    expect(isParseError({ name: 'ParseError', code: 'NETWORK' })).toBe(true);
  });
  test('fromFetchFailure：AbortError=TIMEOUT，其他=NETWORK', () => {
    expect(fromFetchFailure(Object.assign(new Error('x'), { name: 'AbortError' }), 'p').code).toBe('TIMEOUT');
    expect(fromFetchFailure(new TypeError('Failed to fetch'), 'p').code).toBe('NETWORK');
    const pe = new ParseError('QUOTA_EXCEEDED');
    expect(fromFetchFailure(pe)).toBe(pe);
  });
});

describe('classifyHttpError：403 空 body vs 401 vs 额度', () => {
  test('401 → AUTH_INVALID', () => {
    expect(classifyHttpError({ status: 401, bodyText: '{"code":401}', json: { code: 401 } }, 'p').code).toBe('AUTH_INVALID');
    expect(classifyHttpError({ status: 401, bodyText: '' }, 'p').code).toBe('AUTH_INVALID');
  });
  test('403 空 body → PROVIDER_FAILED + reason=forbidden_empty（不是 Key、不是额度）', () => {
    for (const bodyText of ['', '   ', undefined]) {
      const e = classifyHttpError({ status: 403, bodyText }, 'paddleocr');
      expect(e.code).toBe('PROVIDER_FAILED');
      expect(e.reason).toBe(ERROR_REASONS.FORBIDDEN_EMPTY_BODY);
      expect(e.httpStatus).toBe(403);
    }
  });
  test('403 带额度 body → QUOTA_EXCEEDED', () => {
    const json = { errorCode: 403, errorMsg: 'daily quota exceeded' };
    expect(classifyHttpError({ status: 403, bodyText: JSON.stringify(json), json }, 'p').code).toBe('QUOTA_EXCEEDED');
    expect(classifyHttpError({ status: 403, bodyText: 'Forbidden' }, 'p').code).toBe('QUOTA_EXCEEDED');
  });
  test('403 body 明确说鉴权 → AUTH_INVALID', () => {
    const json = { msg: 'invalid token' };
    expect(classifyHttpError({ status: 403, bodyText: 'x', json }, 'p').code).toBe('AUTH_INVALID');
  });
  test('429：带 Retry-After=RATE_LIMITED，不带=QUOTA_EXCEEDED', () => {
    const r = classifyHttpError({ status: 429, bodyText: '', retryAfter: '3' }, 'p');
    expect(r.code).toBe('RATE_LIMITED');
    expect(r.retryAfterMs).toBe(3000);
    expect(classifyHttpError({ status: 429, bodyText: '', retryAfter: new Date(Date.now() + 5000).toUTCString() }, 'p').code).toBe('RATE_LIMITED');
    expect(classifyHttpError({ status: 429, bodyText: '' }, 'p').code).toBe('QUOTA_EXCEEDED');
  });
  test('413/415/5xx', () => {
    expect(classifyHttpError({ status: 413 }, 'p').code).toBe('TOO_LARGE');
    expect(classifyHttpError({ status: 415 }, 'p').code).toBe('FILE_UNSUPPORTED');
    expect(classifyHttpError({ status: 502, bodyText: '' }, 'p').code).toBe('PROVIDER_FAILED');
  });
  test('readErrorResponse 处理空 body / 非 JSON / Retry-After', async () => {
    const mk = (status, body, h = {}) => ({ status, text: async () => body, headers: { get: (k) => h[k] ?? null } });
    expect(await readErrorResponse(mk(403, ''))).toEqual({ status: 403, bodyText: '', json: null, retryAfter: null });
    expect((await readErrorResponse(mk(500, '<html>'))).json).toBeNull();
    expect((await readErrorResponse(mk(429, '{"a":1}', { 'Retry-After': '2' }))).retryAfter).toBe('2');
    const broken = { status: 500, text: async () => { throw new Error('x'); }, headers: {} };
    expect((await readErrorResponse(broken)).bodyText).toBe('');
  });
});

describe('formatParseError', () => {
  test('填入后端名和动作', () => {
    const f = formatParseError(new ParseError('QUOTA_EXCEEDED', { provider: 'paddleocr' }), translations.zh, { providerLabel: 'PaddleOCR' });
    expect(f.message).toBe('PaddleOCR 的额度已用完，请明天再试或换一个后端');
    expect(f.actions).toEqual([{ id: 'switch', label: '换后端' }]);
  });
  test('PERMISSION_MISSING 填域名', () => {
    const f = formatParseError(new ParseError('PERMISSION_MISSING', { host: 'paddleocr.aistudio-app.com' }), translations.en, { providerLabel: 'PaddleOCR' });
    expect(f.message).toBe('Permission for paddleocr.aistudio-app.com is required to use PaddleOCR');
  });
  test('403 空 body 的提示和额度/Key 不同', () => {
    const e = classifyHttpError({ status: 403, bodyText: '' }, 'paddleocr');
    const f = formatParseError(e, translations.zh, { providerLabel: 'PaddleOCR' });
    expect(f.message).toContain('HTTP 403');
    expect(f.message).not.toBe(formatParseError(new ParseError('QUOTA_EXCEEDED'), translations.zh, { providerLabel: 'PaddleOCR' }).message);
    expect(f.message).not.toBe(formatParseError(new ParseError('AUTH_INVALID'), translations.zh, { providerLabel: 'PaddleOCR' }).message);
  });
  test('普通 Error 兜底为 PROVIDER_FAILED', () => {
    expect(formatParseError(new Error('boom'), translations.en, { providerLabel: 'X' }).message).toBe('X failed: boom');
  });
});

describe('兼容映射', () => {
  test('ERROR_MESSAGES 不再有 MINERU_* 硬编码', () => {
    expect(Object.keys(ERROR_MESSAGES).filter((k) => k.startsWith('MINERU_'))).toEqual([]);
  });
  test('旧键/旧文案都映射到合法新码', () => {
    for (const c of [...Object.values(LEGACY_MINERU_ERROR_CODES), ...Object.values(LEGACY_MINERU_ERROR_TEXT)]) expect(CODES).toContain(c);
  });
});
