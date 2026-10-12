import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { db } from "../db.ts";
import { getGlobalConfigRow, saveGlobalConfig, splitConfigByScope } from "../global-config.ts";
import { getSystemSettingsNav } from "../admin-settings-nav.ts";
import { validateConfigPatch } from "../config-validation.ts";

describe("Pro menu visibility", () => {
  it("hides only Pro menus and preserves ordinary site settings", () => {
    assert.deepEqual(getSystemSettingsNav().filter(item => item.pro).map(item => item.id), ["proSystem"]);
    const hidden = getSystemSettingsNav(false);
    assert.ok(hidden.some(item => item.id === "site"));
    assert.ok(hidden.some(item => item.id === "system"));
    assert.ok(hidden.every(item => !item.pro));
  });
  it("defaults to visible and persists as a system setting independently of personal preferences", () => {
    const original = db.prepare("SELECT value, updated_at FROM system_settings WHERE key = 'show_pro_menus'").get();
    try {
      db.prepare("DELETE FROM system_settings WHERE key = 'show_pro_menus'").run();
      assert.equal(getGlobalConfigRow().show_pro_menus, 1);
      saveGlobalConfig({ showProMenus: false });
      assert.equal(getGlobalConfigRow().show_pro_menus, 0);
      assert.deepEqual(splitConfigByScope({ showProMenus: false, theme: "dark" }), { global: { showProMenus: false }, personal: { theme: "dark" } });
      saveGlobalConfig({ showProMenus: true });
      assert.equal(getGlobalConfigRow().show_pro_menus, 1);
    } finally {
      db.prepare("DELETE FROM system_settings WHERE key = 'show_pro_menus'").run();
      if (original) db.prepare("INSERT INTO system_settings (key, value, updated_at) VALUES ('show_pro_menus', ?, ?)").run(original.value, original.updated_at);
    }
  });
  it("accepts only boolean visibility patches", () => {
    assert.doesNotThrow(() => validateConfigPatch({ showProMenus: false }));
    assert.throws(() => validateConfigPatch({ showProMenus: "false" }));
  });
});
