let enabled = false;
let checked = false;
let reports = 0;
export function reportFrontendError(code: "render-error" | "unhandled-error" | "unhandled-rejection"): void {
  if (!checked) {
    checked = true;
    fetch("/api/logs/frontend").then(response => response.ok ? response.json() : null).then(data => { enabled = data?.enabled === true; if (enabled) reportFrontendError(code); }).catch(() => {});
    return;
  }
  if (!enabled || reports >= 10) return;
  reports++;
  fetch("/api/logs/frontend", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }), keepalive: true }).catch(() => {});
}
