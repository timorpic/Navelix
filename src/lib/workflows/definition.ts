import type { JsonValue, WorkflowDefinition } from "./types.ts";

/** Reject values that JSON would silently change, omit, or execute through toJSON(). */
export function assertJsonValue(value: unknown): asserts value is JsonValue {
  const ancestors = new Set<object>();
  let nodes = 0;
  function visit(item: unknown, depth: number): void {
    if (++nodes > 10000 || depth > 20) throw new Error("Workflow data exceeds its budget");
    if (item === null || typeof item === "boolean" || typeof item === "string") return;
    if (typeof item === "number" && Number.isFinite(item)) return;
    if (typeof item !== "object" || !item || ancestors.has(item)) throw new Error("Workflow data must be JSON serializable");
    const prototype: unknown = Object.getPrototypeOf(item);
    if (Array.isArray(item) ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) throw new Error("Workflow data must use plain objects");
    if (Object.getOwnPropertySymbols(item).length) throw new Error("Workflow data cannot contain symbol keys");
    ancestors.add(item);
    if (Array.isArray(item)) {
      const descriptors = Object.getOwnPropertyDescriptors(item);
      if (Object.keys(descriptors).length !== item.length + 1) throw new Error("Workflow arrays cannot contain extra fields or holes");
      for (let index = 0; index < item.length; index++) {
        const descriptor = descriptors[index];
        if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, "value")) throw new Error("Workflow arrays cannot contain accessors or holes");
        visit(descriptor.value, depth + 1);
      }
    } else {
      for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(item))) {
        if (!descriptor.enumerable || !Object.hasOwn(descriptor, "value")) throw new Error("Workflow data cannot contain accessors or hidden fields");
        visit(descriptor.value, depth + 1);
      }
    }
    ancestors.delete(item);
  }
  visit(value, 0);
  if (JSON.stringify(value).length > 256 * 1024) throw new Error("Workflow data exceeds its budget");
}

export function parseWorkflowDefinition(value: unknown): WorkflowDefinition {
  assertJsonValue(value);
  if (!value || typeof value !== "object" || Array.isArray(value) || value.schemaVersion !== 1 || typeof value.id !== "string" || !/^[a-zA-Z0-9_.-]{1,100}$/.test(value.id) || !Array.isArray(value.steps) || !value.steps.length || value.steps.length > 100 || Object.keys(value).some(key => !["schemaVersion", "id", "steps"].includes(key))) throw new Error("Invalid workflow definition");
  const ids = new Set<string>();
  for (const step of value.steps) {
    if (!step || typeof step !== "object" || Array.isArray(step) || typeof step.id !== "string" || !/^[a-zA-Z0-9_.-]{1,100}$/.test(step.id) || typeof step.operation !== "string" || !/^[a-zA-Z0-9_.-]{1,100}$/.test(step.operation) || !Object.hasOwn(step, "input") || Object.keys(step).some(key => !["id", "operation", "input"].includes(key)) || ids.has(step.id)) throw new Error("Invalid workflow step");
    ids.add(step.id);
  }
  // Return an independent snapshot so callers cannot mutate the executing plan.
  return JSON.parse(JSON.stringify(value)) as WorkflowDefinition;
}
