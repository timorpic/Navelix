import { assertJsonValue } from "../workflows/definition.ts";
import type { WorkflowDefinition, WorkflowHandlers } from "../workflows/types.ts";
import type { LogCleanupPreview, LogCleanupResult, LogSettings } from "./types.ts";

export interface LogManagementPort {
  preview: (settings: Partial<LogSettings>) => Promise<LogCleanupPreview>;
  save: (settings: Partial<LogSettings>, token: string) => Promise<{ settings: LogSettings }>;
  cleanup: (token: string) => Promise<LogCleanupResult>;
}
export interface LogManagementCapabilities {
  api: LogManagementPort;
  confirm: (preview: LogCleanupPreview, cleanup: boolean) => Promise<boolean>;
  onNothingToClean: (preview: LogCleanupPreview) => void;
  onSaved: (settings: LogSettings) => void;
  onCleaned: (result: LogCleanupResult) => void;
  /** Short-lived authorization stays in memory, outside serialized plans/results. */
  preview: LogCleanupPreview | null;
}
export function createLogManagementWorkflow(cleanup: boolean, patch: Partial<LogSettings>): WorkflowDefinition {
  assertJsonValue(patch);
  return {
    schemaVersion: 1,
    id: cleanup ? "logs.cleanup" : "logs.settings.save",
    steps: [
      { id: "preview", operation: cleanup ? "logs.cleanup.preview" : "logs.settings.preview", input: cleanup ? {} : patch },
      { id: "confirm", operation: cleanup ? "logs.cleanup.confirm" : "logs.settings.confirm", input: null },
      { id: "execute", operation: cleanup ? "logs.cleanup.execute" : "logs.settings.save", input: cleanup ? {} : patch },
    ],
  };
}
function requirePreview(capabilities: LogManagementCapabilities): LogCleanupPreview {
  if (!capabilities.preview) throw new Error("Cleanup preview is required");
  return capabilities.preview;
}
const preview: WorkflowHandlers<LogManagementCapabilities>[string] = async (input, { capabilities }) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid settings input");
  const result = await capabilities.api.preview(input as Partial<LogSettings>);
  capabilities.preview = result;
  return { status: "completed", value: { auditCount: result.auditCount, files: result.files, bytes: result.bytes } };
};
function confirmation(cleanup: boolean): WorkflowHandlers<LogManagementCapabilities>[string] {
  return async (_input, { capabilities }) => {
    const result = requirePreview(capabilities);
    if (cleanup && result.auditCount === 0 && result.files === 0) {
      capabilities.onNothingToClean(result);
      return { status: "cancelled" };
    }
    return await capabilities.confirm(result, cleanup) ? { status: "completed", value: true } : { status: "cancelled" };
  };
}
export const LOG_MANAGEMENT_HANDLERS: WorkflowHandlers<LogManagementCapabilities> = {
  "logs.cleanup.preview": preview,
  "logs.settings.preview": preview,
  "logs.cleanup.confirm": confirmation(true),
  "logs.settings.confirm": confirmation(false),
  "logs.cleanup.execute": async (_input, { capabilities }) => {
    const result = await capabilities.api.cleanup(requirePreview(capabilities).token);
    capabilities.onCleaned(result);
    return { status: "completed", value: { ...result } };
  },
  "logs.settings.save": async (input, { capabilities }) => {
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid settings input");
    const result = await capabilities.api.save(input as Partial<LogSettings>, requirePreview(capabilities).token);
    capabilities.onSaved(result.settings);
    return { status: "completed", value: { saved: true } };
  },
};
