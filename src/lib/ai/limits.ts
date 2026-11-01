export class CallLimiter {
  private minuteStart = 0;
  private dayStart = 0;
  private minuteCount = 0;
  private dayCount = 0;
  constructor(private perMinute: number, private perDay: number) {}
  take(now = Date.now()) {
    if (now - this.minuteStart >= 60000) { this.minuteStart = now; this.minuteCount = 0; }
    if (now - this.dayStart >= 86400000) { this.dayStart = now; this.dayCount = 0; }
    if (this.minuteCount >= this.perMinute || this.dayCount >= this.perDay) return false;
    this.minuteCount++; this.dayCount++; return true;
  }
}
export async function readLimitedJson(request: Request, maxBytes = 32000): Promise<unknown> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new Error("invalid_request");
  const origin = request.headers.get("origin");
  if (origin) {
    const source = new URL(origin);
    const target = new URL(request.url);
    // Next may normalize request.url to localhost; use the actual Host, never forwarded headers.
    const host = request.headers.get("host") ?? target.host;
    if (source.host !== host || source.protocol !== target.protocol) throw new Error("invalid_request");
  }
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBytes || !request.body) throw new Error("invalid_request");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) { await reader.cancel(); throw new Error("invalid_request"); }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(body));
}
