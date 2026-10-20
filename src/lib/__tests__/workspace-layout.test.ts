import assert from "node:assert/strict";
import { test } from "node:test";
import { accountSocialLinks } from "../social-links.ts";
import { askWorkspaceAssistant, createConversationId, decidePendingDeletion } from "../client/assistant.ts";

test("account destinations omit unsafe schemes, credentials and mail header injection", () => {
  assert.deepEqual(accountSocialLinks({ socialGithub: "github.com/timorpic", socialX: "javascript:alert(1)", socialLinkedin: "https://user:secret@example.com", socialEmail: "hello@example.com\r\nBcc:other@example.com" }), [{ label: "GitHub", href: "https://github.com/timorpic" }]);
  assert.deepEqual(accountSocialLinks({ socialGithub: "https://github.com/test", socialLinksEnabled: false }), []);
  assert.deepEqual(accountSocialLinks({ socialEmail: "mailto:hello@example.com" }), [{ label: "Email", href: "mailto:hello@example.com" }]);
});

test("assistant requests retain conversation scope, limit history, and propagate HTTP failures", async context => {
  const requests: Record<string, unknown>[] = [];
  context.mock.method(globalThis, "fetch", async (_url: string, options: RequestInit) => {
    requests.push(JSON.parse(String(options.body)) as Record<string, unknown>);
    return Response.json({ text: "Your plan" });
  });
  const id = createConversationId();
  assert.match(id, /^[a-zA-Z0-9-]{1,80}$/);
  const history = Array.from({ length: 12 }, (_, index) => ({ id: String(index), sender: "user" as const, text: `message ${index}` }));
  assert.deepEqual(await askWorkspaceAssistant("Plan today", id, history, new AbortController().signal), { text: "Your plan", deletions: [] });
  assert.equal(requests[0].conversationId, id);
  assert.deepEqual(requests[0].history, history.slice(-6));
  context.mock.method(globalThis, "fetch", async () => Response.json({ message: "Please sign in" }, { status: 401 }));
  await assert.rejects(askWorkspaceAssistant("Plan today", id, [], new AbortController().signal), /Please sign in/);
});

test("assistant surfaces only well-formed staged deletions for the confirmation card", async context => {
  const pendingId = "a".repeat(32);
  context.mock.method(globalThis, "fetch", async () => Response.json({
    text: "已暂存删除请求",
    deletions: [
      { pendingId, targetName: "Ship", message: "⚠️ 确认删除「Ship」" },
      { pendingId: "not-a-nonce", targetName: "Bad", message: "" },
      { targetName: "Missing id", message: "" },
      null,
    ],
  }));
  const reply = await askWorkspaceAssistant("删除 Ship", createConversationId(), [], new AbortController().signal);
  assert.equal(reply.text, "已暂存删除请求");
  assert.deepEqual(reply.deletions, [{ pendingId, targetName: "Ship", message: "⚠️ 确认删除「Ship」" }]);
});

test("confirmation decision posts the enum instead of a natural-language reply", async context => {
  const requests: Record<string, unknown>[] = [];
  context.mock.method(globalThis, "fetch", async (url: string, options: RequestInit) => {
    requests.push({ url, body: JSON.parse(String(options.body)) as Record<string, unknown> });
    return Response.json({ success: true, message: "已删除待办「Ship」。" });
  });
  const pendingId = "b".repeat(32);
  assert.deepEqual(await decidePendingDeletion(pendingId, "confirm"), { message: "已删除待办「Ship」。" });
  assert.deepEqual(requests[0], { url: "/api/ai/confirm-delete", body: { pendingId, decision: "confirm" } });
  context.mock.method(globalThis, "fetch", async () => Response.json({ error: "确认请求不存在或已过期，请重新发起删除。", message: "确认请求不存在或已过期，请重新发起删除。" }, { status: 404 }));
  await assert.rejects(decidePendingDeletion(pendingId, "cancel"), /确认请求不存在或已过期/);
});

test("conversation IDs work on NAS HTTP origins without randomUUID", () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis.crypto, "randomUUID");
  Object.defineProperty(globalThis.crypto, "randomUUID", { configurable: true, value: undefined });
  try {
    const first = createConversationId();
    assert.match(first, /^[a-f0-9]{32}$/);
    assert.notEqual(createConversationId(), first);
  } finally {
    if (descriptor) Object.defineProperty(globalThis.crypto, "randomUUID", descriptor);
    else Reflect.deleteProperty(globalThis.crypto, "randomUUID");
  }
});
