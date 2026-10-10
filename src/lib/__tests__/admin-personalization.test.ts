import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  blurStatusText,
  buildWidgetToggles,
  isGlassmorphismEnabled,
  previewWidthClass,
  resolveWallpaperMode,
  wallpaperStatusText,
} from "../admin-personalization.ts";

/**
 * 界面偏好页派生逻辑单测。
 *
 * 重点是把「缺省即开启」这条约定固定下来：6 个侧边栏组件开关都用
 * `!== false` 判定，老库缺列时必须是「显示」而非「隐藏」。
 */

describe("previewWidthClass", () => {
  it("四个已知宽度映射到对应预览条宽度", () => {
    assert.equal(previewWidthClass("1000px"), "w-[60%]");
    assert.equal(previewWidthClass("1200px"), "w-[72%]");
    assert.equal(previewWidthClass("1400px"), "w-[84%]");
    assert.equal(previewWidthClass("full"), "w-full");
  });

  it("未知或缺失时回落 1200px 对应的宽度", () => {
    assert.equal(previewWidthClass(undefined), "w-[72%]");
    assert.equal(previewWidthClass(""), "w-[72%]");
    assert.equal(previewWidthClass("999px"), "w-[72%]");
  });
});

describe("resolveWallpaperMode", () => {
  it("显式值原样返回", () => {
    assert.equal(resolveWallpaperMode({ wallpaperMode: "custom" }), "custom");
    assert.equal(resolveWallpaperMode({ wallpaperMode: "none" }), "none");
  });

  it("缺失时默认 bing", () => {
    assert.equal(resolveWallpaperMode({}), "bing");
    assert.equal(resolveWallpaperMode({ wallpaperMode: undefined }), "bing");
  });
});

describe("isGlassmorphismEnabled", () => {
  it("缺省视为开启，仅显式 false 才关闭", () => {
    assert.equal(isGlassmorphismEnabled({}), true);
    assert.equal(isGlassmorphismEnabled({ glassmorphism: undefined }), true);
    assert.equal(isGlassmorphismEnabled({ glassmorphism: true }), true);
    assert.equal(isGlassmorphismEnabled({ glassmorphism: false }), false);
  });
});

describe("状态文案", () => {
  it("壁纸文案三态", () => {
    assert.equal(wallpaperStatusText("bing"), "无线统背景 (Bing)");
    assert.equal(wallpaperStatusText("custom"), "自定义 URL 背景");
    assert.equal(wallpaperStatusText("none"), "纯色背景");
  });

  it("毛玻璃文案两态", () => {
    assert.equal(blurStatusText(true), "毛玻璃已启用");
    assert.equal(blurStatusText(false), "未开启毛玻璃");
  });
});

describe("buildWidgetToggles", () => {
  it("固定 6 项，顺序与 id 稳定", () => {
    const toggles = buildWidgetToggles({});
    assert.deepEqual(
      toggles.map((t) => t.id),
      [
        "aiCopilot",
        "todayActivity",
        "modelMonitor",
        "linkStatus",
        "quickAccess",
        "pendingReminders",
      ],
    );
    assert.deepEqual(
      toggles.map((t) => t.configKey),
      [
        "aiCopilotEnabled",
        "todayActivityEnabled",
        "modelMonitorEnabled",
        "linkStatusEnabled",
        "recentVisitsEnabled",
        "pendingRemindersEnabled",
      ],
    );
  });

  it("空配置下 6 项全部为显示（缺省即开启）", () => {
    for (const t of buildWidgetToggles({})) {
      assert.equal(t.enabled, true, `${t.id} 缺省应为显示`);
      assert.equal(t.toggleValue, false, `${t.id} 点击后应切到隐藏`);
    }
  });

  it("显式 false 的项为隐藏，点击后切到显示", () => {
    const toggles = buildWidgetToggles({ modelMonitorEnabled: false, linkStatusEnabled: false });
    const byId = Object.fromEntries(toggles.map((t) => [t.id, t]));
    assert.equal(byId.modelMonitor.enabled, false);
    assert.equal(byId.modelMonitor.toggleValue, true);
    assert.equal(byId.linkStatus.enabled, false);
    assert.equal(byId.aiCopilot.enabled, true, "未设置的项不受影响");
  });

  it("快捷访问读的是 recentVisitsEnabled 而非同名的 quickAccess", () => {
    const [qa] = buildWidgetToggles({ recentVisitsEnabled: false }).filter(
      (t) => t.id === "quickAccess",
    );
    assert.equal(qa.configKey, "recentVisitsEnabled");
    assert.equal(qa.enabled, false);
  });

  it("每项都有非空标题与描述", () => {
    for (const t of buildWidgetToggles({})) {
      assert.ok(t.title.length > 0, `${t.id} 缺标题`);
      assert.ok(t.desc.length > 0, `${t.id} 缺描述`);
      assert.ok(t.icon.length > 0, `${t.id} 缺图标`);
    }
  });
});
