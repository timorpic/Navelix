/** Serializable descriptions contain data only; capabilities belong to the caller. */
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export interface WorkflowStep {
  id: string;
  operation: string;
  input: JsonValue;
}
export interface WorkflowDefinition {
  schemaVersion: 1;
  id: string;
  steps: WorkflowStep[];
}
export type StepResult = { status: "completed"; value: JsonValue } | { status: "cancelled" };
export interface WorkflowResult {
  schemaVersion: 1;
  status: "completed" | "cancelled";
  results: Record<string, JsonValue>;
}
export interface StepContext<Capabilities> {
  capabilities: Capabilities;
  results: Readonly<Record<string, JsonValue>>;
  signal?: AbortSignal;
}
export type WorkflowHandlers<Capabilities> = Readonly<Record<string,
  (input: JsonValue, context: StepContext<Capabilities>) => StepResult | Promise<StepResult>>>;
