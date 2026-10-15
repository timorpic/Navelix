import { assertJsonValue, parseWorkflowDefinition } from "./definition.ts";
import type { JsonValue, WorkflowDefinition, WorkflowHandlers, WorkflowResult } from "./types.ts";

/** Sequential, in-process composition. Each capability still owns authorization/transactions. */
export async function executeWorkflow<Capabilities>(
  definition: WorkflowDefinition,
  handlers: WorkflowHandlers<Capabilities>,
  capabilities: Capabilities,
  signal?: AbortSignal,
): Promise<WorkflowResult> {
  const plan = parseWorkflowDefinition(definition);
  // Check the entire operation allowlist before any side effect.
  for (const step of plan.steps) {
    if (!Object.hasOwn(handlers, step.operation) || typeof handlers[step.operation] !== "function") throw new Error(`Unsupported workflow operation: ${step.operation}`);
  }
  const results: Record<string, JsonValue> = Object.create(null) as Record<string, JsonValue>;
  for (const step of plan.steps) {
    signal?.throwIfAborted();
    const result = await handlers[step.operation](step.input, { capabilities, results: Object.freeze(JSON.parse(JSON.stringify(results)) as Record<string, JsonValue>), signal });
    if (result.status === "cancelled") return { schemaVersion: 1, status: "cancelled", results: { ...results } };
    if (result.status !== "completed") throw new Error("Invalid workflow step result");
    assertJsonValue(result.value);
    results[step.id] = JSON.parse(JSON.stringify(result.value)) as JsonValue;
  }
  return { schemaVersion: 1, status: "completed", results: { ...results } };
}
