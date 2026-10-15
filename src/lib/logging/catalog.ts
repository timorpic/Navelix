import type { LogCategory } from "./types.ts";
export function categoryForEvent(action: string, route = ""): LogCategory {
  if (/^(database|storage\.backup|storage\.database|backup)/.test(action) || /\/admin\/(backup|storage)/.test(route)) return "backup";
  if (/^(auth|user\.|session|token|security)/.test(action) || /\/auth\//.test(route) || route === "/api/admin/users") return "security";
  if (/^(ai\.)/.test(action) || route.startsWith("/api/ai/")) return "ai";
  if (/^(notification|telegram)/.test(action) || /\/notifications|\/telegram/.test(route)) return "notification";
  if (/^(project|todo|calendar|workspace)/.test(action) || /\/projects|\/todos|\/calendar/.test(route)) return "workspace";
  if (/^(link|category|share|navigation)/.test(action) || /\/links|\/categories|\/share|\/favicon|\/link-status/.test(route)) return "navigation";
  if (/^(config|storage\.config|license|logs|ee\.)/.test(action) || /\/admin\/(settings|license|logs)/.test(route)) return "system";
  return "runtime";
}
