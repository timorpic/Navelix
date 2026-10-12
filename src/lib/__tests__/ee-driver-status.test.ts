import { beforeEach, after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { getEEDriverStatus, isEEAvailable, registerEEDrivers, getStorageDriver, getProbeDriver } from "../ee-bridge/index.ts";
import { setEELoadState } from "../ee-bridge/load-state.ts";
import { NullStorageDriver, NullLinkProbeDriver } from "../ee-bridge/stubs.ts";
import { parseEEDriverStatus, eeDriverStatusDescription, eeDriverStatusLabel } from "../ee-driver-status.ts";

const driverKey = Symbol.for("navelix.ee.drivers");
const stateKey = Symbol.for("navelix.ee.load-state");
const registry = globalThis as unknown as Record<symbol, unknown>;
const original = [registry[driverKey], registry[stateKey]];
beforeEach(() => { delete registry[driverKey]; delete registry[stateKey]; });
after(() => {
  for (const [index, key] of [driverKey, stateKey].entries()) {
    if (original[index] === undefined) delete registry[key]; else registry[key] = original[index];
  }
});

describe("EE runtime diagnostics", () => {
  it("does not report fallback drivers as registered or assume an unobserved load failed", () => {
    getStorageDriver(); getProbeDriver();
    assert.deepEqual(getEEDriverStatus(), { state: "unknown", storageRegistered: false, probeRegistered: false, failure: null });
    assert.equal(isEEAvailable(), false);
  });
  it("distinguishes absent artifacts, loader failures and a loaded artifact without registrations", () => {
    setEELoadState("missing"); assert.equal(getEEDriverStatus().state, "missing");
    setEELoadState("failed", "incompatible-runtime");
    const failed = getEEDriverStatus();
    assert.equal(failed.state, "failed");
    assert.ok(eeDriverStatusDescription(failed).includes("Node/V8"));
    setEELoadState("failed", "loader-unavailable");
    assert.ok(eeDriverStatusDescription(getEEDriverStatus()).includes("字节码加载器"));
    setEELoadState("failed", "load-error");
    assert.ok(eeDriverStatusDescription(getEEDriverStatus()).includes("启动日志"));
    setEELoadState("loaded"); assert.equal(getEEDriverStatus().state, "partial");
  });
  it("reflects partial and complete registrations and never exposes keys", () => {
    registerEEDrivers({ storageDriver: new NullStorageDriver(), officialPublicKey: "private-fixture" });
    assert.equal(getEEDriverStatus().state, "partial");
    assert.equal(getEEDriverStatus().probeRegistered, false);
    registerEEDrivers({ probeDriver: new NullLinkProbeDriver() });
    assert.deepEqual(getEEDriverStatus(), { state: "loaded", storageRegistered: true, probeRegistered: true, failure: null });
    assert.equal(isEEAvailable(), true);
    assert.ok(!JSON.stringify(getEEDriverStatus()).includes("private"));
  });
  it("validates public diagnostics and provides labels for every state", () => {
    for (const state of ["loaded", "partial", "missing", "failed", "unknown"] as const) {
      const value = { state, storageRegistered: false, probeRegistered: false, failure: null };
      assert.deepEqual(parseEEDriverStatus(value), value);
      assert.ok(eeDriverStatusLabel(state)); assert.ok(eeDriverStatusDescription(value));
    }
    for (const value of [null, "loaded", {}, { state: "oops" }, { state: "loaded", storageRegistered: "true", probeRegistered: true, failure: null }]) {
      assert.equal(parseEEDriverStatus(value), null);
    }
  });
});
