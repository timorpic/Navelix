import { EventEmitter } from "node:events";

export type RealtimeEventType =
  | "links:change"
  | "projects:change"
  | "todos:change"
  | "monitor:update"
  | "notifications:new"
  | "categories:change";

export interface RealtimeEvent {
  type: RealtimeEventType;
  userId?: string;
  payload?: Record<string, unknown>;
  timestamp: number;
}

// 单机进程内事件总线（单例）
class RealtimeEventBus extends EventEmitter {
  constructor() {
    super();
    // 增加监听器上限，避免多标签页 SSE 连接产生警告
    this.setMaxListeners(200);
  }

  /** 向特定用户发送事件 */
  emitUserEvent(userId: string, type: RealtimeEventType, payload?: Record<string, unknown>) {
    const event: RealtimeEvent = {
      type,
      userId,
      payload,
      timestamp: Date.now(),
    };
    this.emit(`user:${userId}`, event);
    this.emit("broadcast", event);
  }

  /** 向全站所有活跃连接广播事件 */
  emitBroadcast(type: RealtimeEventType, payload?: Record<string, unknown>) {
    const event: RealtimeEvent = {
      type,
      payload,
      timestamp: Date.now(),
    };
    this.emit("broadcast", event);
  }
}

// 单例模式导出
declare global {
  var __navelix_event_bus__: RealtimeEventBus | undefined;
}

export const eventBus =
  globalThis.__navelix_event_bus__ ||
  (globalThis.__navelix_event_bus__ = new RealtimeEventBus());

export function emitUserEvent(
  userId: string,
  type: RealtimeEventType,
  payload?: Record<string, unknown>,
) {
  eventBus.emitUserEvent(userId, type, payload);
}

export function emitBroadcast(
  type: RealtimeEventType,
  payload?: Record<string, unknown>,
) {
  eventBus.emitBroadcast(type, payload);
}
