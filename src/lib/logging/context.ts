import { AsyncLocalStorage } from "node:async_hooks";
import type { LogCategory } from "./types.ts";
export interface LogContext { category?: LogCategory; requestId: string; operationId: string; actorId?: string; source?: "web" | "api" | "scheduler"; }
export const logContext = new AsyncLocalStorage<LogContext>();
export function setLogActor(actorId: string): void {
  const context = logContext.getStore();
  if (context) context.actorId = actorId;
}
