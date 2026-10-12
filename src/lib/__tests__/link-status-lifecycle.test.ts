import { before, after, afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createElement, act } from "react";
import { loadTsx, setupDom, teardownDom } from "./helpers/tsx-loader.ts";
import { render } from "./helpers/render.ts";
import type { SiteLink } from "../../types/index.ts";
import type { useLinkStatus as Hook } from "../../hooks/use-link-status.ts";

let useLinkStatus: typeof Hook;
const realFetch = globalThis.fetch;
before(async () => {
  await setupDom();
  useLinkStatus = (await loadTsx("src/hooks/use-link-status.ts")).useLinkStatus as typeof Hook;
});
afterEach(() => { globalThis.fetch = realFetch; });
after(teardownDom);
const links: SiteLink[] = Array.from({ length: 12 }, (_, i) => ({ id: String(i), title: String(i), url: `https://example.com/${i}`, category: "test", description: "", icon: "" }));
function Probe({ enabled = true }: { enabled?: boolean }) {
  const result = useLinkStatus(links, 60_000, enabled);
  return createElement("output", null, JSON.stringify(result.statuses));
}

describe("link status request lifecycle", () => {
  it("aborts on disabling and stops the pending batch from sending another request", async () => {
    let calls = 0;
    let resolve: (value: Response) => void = () => {};
    let signal: AbortSignal | null = null;
    globalThis.fetch = async (_url, init) => {
      calls++; signal = init?.signal ?? null;
      return new Promise<Response>(done => { resolve = done; });
    };
    const view = render(Probe);
    assert.equal(calls, 1);
    view.rerender({ enabled: false });
    assert.equal((signal as AbortSignal | null)?.aborted, true);
    await act(async () => { resolve(Response.json({ results: [] })); });
    assert.equal(calls, 1);
    assert.equal(view.container.textContent, "{}");
    view.unmount();
  });
  it("aborts on unmount rather than continuing through remaining batches", async () => {
    let calls = 0;
    let resolve: (value: Response) => void = () => {};
    globalThis.fetch = async () => { calls++; return new Promise<Response>(done => { resolve = done; }); };
    const view = render(Probe);
    view.unmount();
    await act(async () => { resolve(Response.json({ results: [] })); });
    assert.equal(calls, 1);
  });
  it("finishes checking on HTTP failures and empty results", async () => {
    globalThis.fetch = async () => new Response("{}", { status: 403 });
    const view = render(Probe);
    await act(async () => {});
    const statuses = JSON.parse(view.container.textContent ?? "{}");
    assert.equal(Object.keys(statuses).length, 12);
    assert.ok(Object.values(statuses).every(value => (value as { status: string }).status === "unknown"));
    view.unmount();
  });
});
