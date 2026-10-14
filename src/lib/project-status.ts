export const PROJECT_STATUS_LABELS = {
  "in-progress": "进行中",
  research: "研究中",
  maintenance: "维护中",
  completed: "已完成",
} as const;
export type ProjectStatus = keyof typeof PROJECT_STATUS_LABELS;
/** Exact labels written by the old English UI, alongside the Chinese labels. */
export const LEGACY_PROJECT_STATUSES: Record<string, ProjectStatus> = {
  "进行中": "in-progress", "研究中": "research", "维护中": "maintenance", "已完成": "completed",
  "In progress": "in-progress", Research: "research", Maintenance: "maintenance", Completed: "completed",
};
/** Preserve user-defined statuses; only exact built-in labels are normalized. */
export function normalizeProjectStatus(value: unknown): string {
  const status = String(value || "in-progress").trim();
  return Object.hasOwn(LEGACY_PROJECT_STATUSES, status) ? LEGACY_PROJECT_STATUSES[status] : status;
}
export function projectStatusLabel(value: unknown): string {
  const status = normalizeProjectStatus(value);
  return PROJECT_STATUS_LABELS[status as ProjectStatus] ?? status;
}

export function isActiveProjectStatus(value: unknown): boolean {
  const status = normalizeProjectStatus(value);
  return status === "in-progress" || status === "research";
}
