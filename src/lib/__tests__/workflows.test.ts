import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertJsonValue, parseWorkflowDefinition } from "../workflows/definition.ts";
import { executeWorkflow } from "../workflows/execute.ts";
import type { WorkflowDefinition, WorkflowHandlers } from "../workflows/types.ts";
import { createLogManagementWorkflow, LOG_MANAGEMENT_HANDLERS, type LogManagementCapabilities } from "../logging/management-workflow.ts";
import { DEFAULT_LOG_SETTINGS } from "../logging/settings.ts";
import { buildLogFilter, createLogFilterDraft, relatedLogFilter } from "../logging/filter-state.ts";

const plan: WorkflowDefinition = { schemaVersion: 1, id: "test.pipeline", steps: [
  { id: "first", operation: "test.first", input: { count: 2 } },
  { id: "second", operation: "test.second", input: null },
] };
describe("serializable workflow composition", () => {
  it("round-trips plans/results and passes outputs to injected capabilities in order", async () => {
    const calls: string[] = [];
    const handlers: WorkflowHandlers<{ calls: string[] }> = {
      "test.first": (input, { capabilities }) => { capabilities.calls.push("first"); return { status: "completed", value: input }; },
      "test.second": (_input, { capabilities, results }) => { capabilities.calls.push("second"); return { status: "completed", value: results.first }; },
    };
    const definition = parseWorkflowDefinition(JSON.parse(JSON.stringify(plan)));
    const result = await executeWorkflow(definition, handlers, { calls });
    assert.deepEqual(calls, ["first", "second"]);
    assert.deepEqual(result, JSON.parse(JSON.stringify(result)));
    assert.deepEqual(result.results.second, { count: 2 });
  });
  it("isolates recorded outputs from mutations in a later step", async () => {
    const result = await executeWorkflow(plan, {
      "test.first": () => ({ status: "completed", value: { count: 2 } }),
      "test.second": (_input, { results }) => {
        const previous = results.first;
        if (previous && typeof previous === "object" && !Array.isArray(previous)) previous.count = 99;
        return { status: "completed", value: previous };
      },
    }, null);
    assert.deepEqual(result.results.first, { count: 2 });
    assert.deepEqual(result.results.second, { count: 99 });
  });
  it("validates every operation and step before any side effect", async () => {
    let called = false;
    await assert.rejects(executeWorkflow(plan, { "test.first": () => { called = true; return { status: "completed", value: null }; } }, {}));
    assert.equal(called, false);
    assert.throws(() => parseWorkflowDefinition({ ...plan, schemaVersion: 2 }));
    assert.throws(() => parseWorkflowDefinition({ ...plan, steps: [plan.steps[0], plan.steps[0]] }));
    assert.throws(() => parseWorkflowDefinition({ ...plan, steps: [{ id: "x", operation: "test.first" }] }));
    await assert.rejects(executeWorkflow({ ...plan, steps: [{ ...plan.steps[0], operation: "toString" }] }, {}, {}));
  });
  it("stops on cancellation, failure and an aborted signal", async () => {
    let second = false;
    const handlers: WorkflowHandlers<null> = {
      "test.first": () => ({ status: "cancelled" }),
      "test.second": () => { second = true; return { status: "completed", value: null }; },
    };
    assert.equal((await executeWorkflow(plan, handlers, null)).status, "cancelled");
    assert.equal(second, false);
    await assert.rejects(executeWorkflow(plan, { ...handlers, "test.first": () => { throw new Error("failure"); } }, null), /failure/);
    assert.equal(second, false);
    await assert.rejects(executeWorkflow(plan, handlers, null, AbortSignal.abort()), { name: "AbortError" });
  });
  it("rejects lossy/non-data values without invoking accessors or toJSON", () => {
    let called = false;
    const accessor = Object.defineProperty({}, "value", { enumerable: true, get: () => { called = true; return 1; } });
    const array: unknown[] = [1]; Object.defineProperty(array, "0", { enumerable: true, get: () => { called = true; return 1; } });
    const cyclic: Record<string, unknown> = {}; cyclic.self = cyclic;
    for (const value of [undefined, NaN, Infinity, 1n, new Date(), () => 1, new Map(), [undefined], Array(1), accessor, array, cyclic, { toJSON: () => { called = true; return {}; } }]) assert.throws(() => assertJsonValue(value));
    assert.equal(called, false);
  });
});

describe("composed log management", () => {
  function fixture(confirmed: boolean, empty = false) {
    const calls: string[] = [];
    const preview = { token: "private-preview-token", expiresAt: 1, auditCount: empty ? 0 : 2, files: 0, bytes: 0, settings: DEFAULT_LOG_SETTINGS };
    const capabilities: LogManagementCapabilities = {
      preview: null,
      api: {
        preview: async () => { calls.push("preview"); return preview; },
        save: async (_settings, token) => { assert.equal(token, preview.token); calls.push("save"); return { settings: DEFAULT_LOG_SETTINGS }; },
        cleanup: async token => { assert.equal(token, preview.token); calls.push("cleanup"); return { auditCount: 2, removed: 0, releasedBytes: 0, partial: false }; },
      },
      confirm: async () => { calls.push("confirm"); return confirmed; },
      onSaved: () => calls.push("saved"), onCleaned: () => calls.push("cleaned"), onNothingToClean: () => calls.push("empty"),
    };
    return { capabilities, calls };
  }
  it("composes preview, confirmation and save while keeping credentials out of JSON", async () => {
    const { capabilities, calls } = fixture(true);
    const definition = createLogManagementWorkflow(false, { level: "info" });
    const result = await executeWorkflow(definition, LOG_MANAGEMENT_HANDLERS, capabilities);
    assert.deepEqual(calls, ["preview", "confirm", "save", "saved"]);
    assert.ok(!JSON.stringify({ definition, result }).includes("private-preview-token"));
  });
  it("cancels before cleanup and treats an empty preview as a no-op", async () => {
    for (const empty of [false, true]) {
      const { capabilities, calls } = fixture(false, empty);
      assert.equal((await executeWorkflow(createLogManagementWorkflow(true, {}), LOG_MANAGEMENT_HANDLERS, capabilities)).status, "cancelled");
      assert.deepEqual(calls, empty ? ["preview", "empty"] : ["preview", "confirm"]);
    }
  });
  it("executes cleanup only after confirmation", async () => {
    const { capabilities, calls } = fixture(true);
    await executeWorkflow(createLogManagementWorkflow(true, {}), LOG_MANAGEMENT_HANDLERS, capabilities);
    assert.deepEqual(calls, ["preview", "confirm", "cleanup", "cleaned"]);
  });
  it("serializes filters and removes stale conditions when opening related operations", () => {
    const draft = { ...createLogFilterDraft(), category: "workspace", q: "text & unicode 中文" };
    const copy = JSON.parse(JSON.stringify(draft)) as typeof draft;
    assert.equal(buildLogFilter(draft, 1792000000000), buildLogFilter(copy, 1792000000000));
    const related = relatedLogFilter({ operationId: "operation-id", timestamp: 1792000000000 });
    assert.equal(related.category, ""); assert.equal(related.q, "");
    assert.equal(new URLSearchParams(buildLogFilter(related, 1792000000000)).get("operationId"), "operation-id");
    assert.throws(() => buildLogFilter({ ...draft, start: "invalid" }, 1792000000000));
    assert.throws(() => buildLogFilter({ ...draft, start: "2026-10-15T12:00", end: "2026-10-14T12:00" }, 1792000000000));
  });
});
