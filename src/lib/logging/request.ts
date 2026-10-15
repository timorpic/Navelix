import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { logContext } from "./context.ts";
import { writeLog } from "./events.ts";
import { categoryForEvent } from "./catalog.ts";
/** Static route templates, never raw URLs, query strings, response bodies, or tokens. */
export function withRequestLogging<C>(route: string, handler: (request: NextRequest, context: C) => Response | Promise<Response>) {
  return async (request: NextRequest, context: C): Promise<Response> => {
    const requestId = randomUUID();
    return logContext.run({ requestId, operationId: requestId, category: categoryForEvent("", route), source: request.headers.has("origin") ? "web" : "api" }, async () => {
      const start = performance.now();
      const category = categoryForEvent("", route);
      const routeEvent = route.replace(/^\/api\//, "").replaceAll("[id]", "item").replaceAll("/", ".").replaceAll("-", "_");
      try {
        const response = await handler(request, context);
        const durationMs = performance.now() - start;
        const write = !["GET", "HEAD", "OPTIONS"].includes(request.method);
        const excluded = /\/logs(?:\/|$)|\/audit-logs$|\/auth\/refresh$|\/notifications\/read$/.test(route);
        if (response.status >= 400 || durationMs >= 2000 || (write && !excluded)) {
          writeLog({ category, event: `${routeEvent}.${request.method.toLowerCase()}.${response.status >= 400 ? "failed" : "completed"}`, kind: write ? "business" : "request",
            level: response.status >= 500 ? "error" : response.status >= 400 || durationMs >= 2000 ? "warn" : "info",
            outcome: response.status >= 400 ? "failed" : "succeeded", durationMs, code: `HTTP_${response.status}`,
            details: { method: request.method, route, status: response.status } });
        }
        if (response.headers.get("content-type")?.includes("text/event-stream")) {
          writeLog({ category, event: "runtime.stream.opened", level: "debug", kind: "request", durationMs });
          request.signal.addEventListener("abort", () => {
            writeLog({ category, event: "runtime.stream.closed", outcome: "cancelled", level: "debug", kind: "request", durationMs: performance.now() - start });
          }, { once: true });
        }
        response.headers.set("X-Request-Id", requestId);
        return response;
      } catch (error) {
        writeLog({ category, event: `${routeEvent}.exception`, kind: "request", level: "error", outcome: "failed", durationMs: performance.now() - start,
          code: "UNHANDLED_EXCEPTION", details: { method: request.method, route, errorName: error instanceof Error ? error.name : "UnknownError" } });
        throw error;
      }
    });
  };
}
