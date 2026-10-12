import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SYSTEM_SETTINGS_NAV, USER_SETTINGS_NAV, isSystemSettingsTab, resolveSettingsTab } from "../admin-settings-nav.ts";

describe("consolidated settings navigation", () => {
  it("keeps four system destinations and three user destinations", () => {
    assert.deepEqual(SYSTEM_SETTINGS_NAV.map(item => item.id), ["site", "access", "proSystem", "system"]);
    assert.deepEqual(USER_SETTINGS_NAV.map(item => item.id), ["profile", "account", "proUser"]);
  });
  it("resolves old bookmarks to the correct group without changing their scope", () => {
    for (const [oldTab, target, system] of [
      ["ai", "site", true], ["weather", "site", true],
      ["personalization", "profile", false], ["notifications", "profile", false],
      ["personalData", "account", false],
    ] as const) {
      assert.equal(resolveSettingsTab(oldTab), target);
      assert.equal(isSystemSettingsTab(target), system);
    }
  });
  it("preserves current bookmarks and rejects unknown settings", () => {
    for (const item of [...SYSTEM_SETTINGS_NAV, ...USER_SETTINGS_NAV]) {
      assert.equal(resolveSettingsTab(item.id), item.id);
    }
    assert.equal(resolveSettingsTab("unknown"), undefined);
  });
});
