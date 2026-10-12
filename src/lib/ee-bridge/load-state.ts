import type { EELoadFailure } from "../ee-driver-status.ts";

interface EELoadState {
  state: "unknown" | "missing" | "loaded" | "failed";
  failure: EELoadFailure | null;
}
const KEY = Symbol.for("navelix.ee.load-state");
function registry() { return globalThis as unknown as Record<symbol, EELoadState | undefined>; }
export function setEELoadState(state: EELoadState["state"], failure: EELoadFailure | null = null): void {
  registry()[KEY] = { state, failure };
}
export function getEELoadState(): EELoadState {
  return registry()[KEY] ?? { state: "unknown", failure: null };
}
