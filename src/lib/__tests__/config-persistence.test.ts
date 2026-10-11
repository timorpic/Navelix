import { it } from "node:test";
import assert from "node:assert/strict";
import { configForBrowser } from "../config-persistence.ts";
it("browser config removes secret values without mutating the submitted patch", () => {
  const patch = { aiApiKey: "private-ai", weatherApiKey: "private-weather", theme: "dark" as const };
  const browser = configForBrowser(patch);
  assert.deepEqual(browser, { aiKeyConfigured: true, weatherKeyConfigured: true, theme: "dark" });
  assert.equal(patch.aiApiKey, "private-ai");
  assert.deepEqual(configForBrowser({ aiKeyConfigured: false }), { aiKeyConfigured: false });
});
