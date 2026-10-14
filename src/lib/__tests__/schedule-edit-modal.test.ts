import { after, before, beforeEach, it, mock } from "node:test";
import assert from "node:assert/strict";
import { act } from "react";
import { setupDom, teardownDom, loadTsx } from "./helpers/tsx-loader.ts";
import { render, cleanup } from "./helpers/render.ts";

let ScheduleEditModal: never;
before(async () => {
  await setupDom();
  ScheduleEditModal = (await loadTsx("src/components/schedule-edit-modal.tsx")).default as never;
});
after(() => teardownDom());
beforeEach(() => cleanup());

for (const delegated of [true, false]) {
  it(`${delegated ? "delegated" : "owned"} edits submit only permitted fields and display the existing recipient`, async () => {
    let payload: Record<string, unknown> | undefined;
    let saved = 0, closed = 0;
    const fetchMock = mock.method(globalThis, "fetch", async (_url: unknown, options?: RequestInit) => {
      payload = JSON.parse(String(options?.body)) as Record<string, unknown>;
      return Response.json({ success: true });
    });
    try {
      render(ScheduleEditModal, {
        item: { id: "task", ownerId: "owner", title: "Task", dueDate: "2026-10-14", priority: "medium", projectId: "project", assigneeId: "recipient", assigneeName: "Existing recipient", isDelegated: delegated },
        projects: [], members: [], defaultDateStr: "2026-10-14", onSaved: () => { saved++; }, onClose: () => { closed++; },
      });
      const project = document.querySelector<HTMLSelectElement>('[name="formProjectId"]')!;
      const assignee = document.querySelector<HTMLSelectElement>('[name="formAssigneeId"]')!;
      assert.equal(project.disabled, delegated);
      assert.equal(assignee.disabled, delegated);
      assert.equal(assignee.selectedOptions[0].textContent, "Existing recipient");
      assert.equal(document.body.textContent?.includes("删除事项"), !delegated);
      await act(async () => {
        document.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      });
      assert.ok(payload);
      assert.equal(payload.title, "Task");
      assert.equal(Object.hasOwn(payload, "projectId"), !delegated);
      assert.equal(Object.hasOwn(payload, "assigneeId"), !delegated);
      assert.equal(Object.hasOwn(payload, "assigneeName"), !delegated);
      assert.equal(saved, 1);
      assert.equal(closed, 1);
    } finally { fetchMock.mock.restore(); }
  });
}

it("keeps failed edits open and announces the save failure", async () => {
  let closed = false;
  const fetchMock = mock.method(globalThis, "fetch", async () => Response.json({ error: "denied" }, { status: 403 }));
  try {
    render(ScheduleEditModal, {
      item: { id: "task", title: "Task", priority: "medium", isDelegated: true }, projects: [], members: [], defaultDateStr: "2026-10-14",
      onSaved: () => assert.fail("failed save must not refresh"), onClose: () => { closed = true; },
    });
    await act(async () => {
      document.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    assert.equal(closed, false);
    assert.ok(document.querySelector('[role="alert"]')?.textContent);
  } finally { fetchMock.mock.restore(); }
});
