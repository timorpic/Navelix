/** Carry the composite identity when editing delegated/imported tasks. */
export function todoUrl(id: string, ownerId?: string): string {
  return `/api/todos/${encodeURIComponent(id)}${ownerId ? `?ownerId=${encodeURIComponent(ownerId)}` : ""}`;
}
