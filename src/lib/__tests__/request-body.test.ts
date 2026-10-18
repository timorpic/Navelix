import { it } from "node:test";
import assert from "node:assert/strict";
import { readLimitedJson, RequestBodyError } from "../request-body.ts";

it("bounds both declared and actual JSON body sizes", async () => {
  assert.deepEqual(await readLimitedJson(new Request("http://localhost", { method: "POST", body: '{"ok":true}' }), 32), { ok: true });
  for (const req of [
    new Request("http://localhost", { method: "POST", body: "{}", headers: { "Content-Length": "100" } }),
    new Request("http://localhost", { method: "POST", body: JSON.stringify({ value: "x".repeat(40) }) }),
  ]) await assert.rejects(readLimitedJson(req, 32), (error: unknown) => error instanceof RequestBodyError && error.status === 413);
  await assert.rejects(readLimitedJson(new Request("http://localhost", { method: "POST", body: "bad" }), 32), (error: unknown) => error instanceof RequestBodyError && error.status === 400);
});
