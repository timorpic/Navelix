import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeBookmarkData } from "../bookmark-merge.ts";
import { parseSunPanelJSON } from "../sun-panel.ts";

const category = { id: "existing", name: "Home", label: "Home", icon: "🏠", color: "#00C776" };
const link = { id: "old", title: "Original", url: "https://example.com", description: "Keep", icon: "", category: category.id };

test("merge preserves existing metadata, remaps groups, and deduplicates within the file and across imports", () => {
  const imported = { ...category, id: "imported", name: " home " };
  const fresh = { ...link, id: "new", url: "http://192.168.1.2:8080", category: imported.id };
  const result = mergeBookmarkData([category], [link], [imported], [
    { ...link, id: "duplicate", title: "Changed", url: "HTTPS://EXAMPLE.COM" }, fresh, { ...fresh, id: "duplicate-in-file" },
  ]);
  assert.deepEqual(result.summary, { categories: 0, links: 1, skipped: 2 });
  assert.equal(result.links[0], link);
  assert.equal(result.links[1].category, category.id);
  assert.equal(result.links[1].url, fresh.url);
  assert.deepEqual(mergeBookmarkData(result.categories, result.links, [imported], [fresh]).summary, { categories: 0, links: 0, skipped: 1 });
  assert.equal(link.title, "Original");
});

test("imports create an owned category instead of writing into a subscribed category", () => {
  const shared = { ...category, isSubscribed: true };
  const imported = { ...category, id: "owned" };
  const result = mergeBookmarkData([shared], [], [imported], [{ ...link, category: imported.id }]);
  assert.equal(result.links[0].category, "owned");
  assert.equal(result.summary.categories, 1);
});

test("supported Sun-Panel layouts preserve descriptions, icons, and LAN URLs", () => {
  const item = { title: "NAS", lanUrl: "http://192.168.1.2", remark: "Storage", icon: { src: "data:image/png;base64,AA==" } };
  const group = { title: "Home", children: [item] };
  for (const payload of [{ icons: [group] }, { itemGroupList: [{ title: "Home", itemList: [item] }] }, { groups: [group] }, { categories: [group] }, [group], [item], { items: [item] }]) {
    const parsed = parseSunPanelJSON(JSON.stringify(payload));
    assert.equal(parsed.links.length, 1);
    assert.equal(parsed.links[0].description, "Storage");
    assert.equal(parsed.links[0].icon, item.icon.src);
    assert.equal(parsed.links[0].url, item.lanUrl);
  }
  for (const invalid of ["not json", "null", "{}", '{"icons":[]}']) assert.throws(() => parseSunPanelJSON(invalid));
});

test("real Sun-Panel 1.8.1 UI export imports without rewriting the file", () => {
  const json = readFileSync(new URL("./fixtures/sun-panel-1.8.1.json", import.meta.url), "utf8");
  const parsed = parseSunPanelJSON(json);
  assert.equal(parsed.categories[0].name, "APP");
  assert.equal(parsed.links[0].title, "Router");
  assert.equal(parsed.links[0].url, "http://192.168.1.1");
  assert.equal(parsed.links[0].description, "Local router");
});
