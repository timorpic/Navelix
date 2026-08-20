import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { eventBus, emitUserEvent, emitBroadcast, type RealtimeEvent } from "../events.ts";

describe("Realtime Event Bus (SSE)", () => {
  it("should deliver user-specific events to listening subscribers", async () => {
    const received: RealtimeEvent[] = [];
    const testUserId = "user-test-123";

    const handler = (evt: RealtimeEvent) => {
      received.push(evt);
    };

    eventBus.on(`user:${testUserId}`, handler);

    emitUserEvent(testUserId, "links:change", { linkId: "link-1" });
    emitUserEvent("other-user", "links:change", { linkId: "link-2" });

    eventBus.off(`user:${testUserId}`, handler);

    assert.equal(received.length, 1);
    assert.equal(received[0].type, "links:change");
    assert.equal(received[0].userId, testUserId);
    assert.equal(received[0].payload?.linkId, "link-1");
  });

  it("should broadcast general events to broadcast channel", async () => {
    const broadcasts: RealtimeEvent[] = [];

    const handler = (evt: RealtimeEvent) => {
      broadcasts.push(evt);
    };

    eventBus.on("broadcast", handler);

    emitBroadcast("notifications:new", { title: "Test Alert" });

    eventBus.off("broadcast", handler);

    assert.equal(broadcasts.length, 1);
    assert.equal(broadcasts[0].type, "notifications:new");
    assert.equal(broadcasts[0].payload?.title, "Test Alert");
  });
});
