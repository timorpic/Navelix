export class RequestBodyError extends Error {
  readonly status: 400 | 413;
  constructor(message: string, status: 400 | 413) { super(message); this.status = status; }
}

/** Enforce the byte limit while reading, including chunked bodies without Content-Length. */
export async function readLimitedJson(req: Request, maxBytes: number): Promise<unknown> {
  const declared = Number(req.headers.get("content-length"));
  if (declared > maxBytes) throw new RequestBodyError("请求数据过大", 413);
  const reader = req.body?.getReader();
  if (!reader) throw new RequestBodyError("无效的请求数据", 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new RequestBodyError("请求数据过大", 413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown; }
  catch { throw new RequestBodyError("无效的请求数据", 400); }
}
