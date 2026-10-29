// R4-18：按 URL（字符串前缀或正则）+ 顺序返回响应的 fetch mock
export function mockResponse({ status = 200, json, body, headers = {} } = {}) {
  const text = body !== undefined && typeof body === 'object' && body && body.buffer ? '' : body !== undefined ? body : (json !== undefined ? JSON.stringify(json) : '');
  const h = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    ok: status >= 200 && status < 300, status, statusText: String(status),
    headers: { get: (k) => h[String(k).toLowerCase()] ?? null },
    text: async () => text,
    json: async () => JSON.parse(text),
    arrayBuffer: async () => (typeof body === 'object' && body && body.buffer ? body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) : new TextEncoder().encode(text).buffer),
  };
}

export function createFetchMock() {
  const routes = []; const calls = [];
  const match = (m, url) => (m instanceof RegExp ? m.test(url) : url.startsWith(m));
  const fetch = jest.fn(async (url, init = {}) => {
    const u = String(url);
    calls.push({ url: u, init, method: (init.method || 'GET').toUpperCase(), body: init.body });
    const r = routes.find((x) => match(x.matcher, u) && (!x.method || x.method === (init.method || 'GET').toUpperCase()) && x.queue.length);
    if (!r) throw new Error(`fetch-mock: no response queued for ${init.method || 'GET'} ${u}`);
    const next = r.queue.length > 1 || !r.sticky ? r.queue.shift() : r.queue[0];
    if (next instanceof Error) throw next;
    return typeof next === 'function' ? next(u, init) : mockResponse(next);
  });
  return {
    fetch, calls,
    /** 依次入队；sticky=true 时最后一个响应会重复返回 */
    on(matcher, responses, { method, sticky = false } = {}) {
      routes.push({ matcher, method: method && method.toUpperCase(), queue: [...[].concat(responses)], sticky });
      return this;
    },
    callsTo(matcher) { return calls.filter((c) => match(matcher, c.url)); },
  };
}
