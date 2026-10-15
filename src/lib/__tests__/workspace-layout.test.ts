import assert from "node:assert/strict";
import { test } from "node:test";
import { parseNotificationFeed } from "../workspace-notifications.ts";
import { accountSocialLinks } from "../social-links.ts";
import { askWorkspaceAssistant, createConversationId } from "../client/assistant.ts";

test("notification count includes unread items outside the latest page; invalid responses are rejected", () => {
  const notification = { id: "n1", title: "Saved", content: "Project saved", createdAt: Date.now(), read: false };
  assert.deepEqual(parseNotificationFeed({ notifications: [notification], unreadCount: 82 }), { notifications: [notification], unreadCount: 82 });
  for (const value of [null, {}, { notifications: [], unreadCount: -1 }, { notifications: [notification], unreadCount: 1.5 }, { notifications: [{ ...notification, createdAt: "today" }], unreadCount: 1 }]) assert.throws(() => parseNotificationFeed(value));
});

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
  assert.equal(await askWorkspaceAssistant("Plan today", id, history, new AbortController().signal), "Your plan");
  assert.equal(requests[0].conversationId, id);
  assert.deepEqual(requests[0].history, history.slice(-6));
  context.mock.method(globalThis, "fetch", async () => Response.json({ message: "Please sign in" }, { status: 401 }));
  await assert.rejects(askWorkspaceAssistant("Plan today", id, [], new AbortController().signal), /Please sign in/);
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
