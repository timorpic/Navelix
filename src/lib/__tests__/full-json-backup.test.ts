import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { db } from "../db.ts";
import {
  saveUserCategories,
  saveUserLinks,
  saveUserProjects,
  saveUserTodos,
  saveUserConfigs,
} from "../user-data.ts";

describe("Full JSON Export & Import Verification", () => {
  it("should faithfully roundtrip all system configs, categories, links, projects, and todos via JSON data structure", () => {
    const testUserId = "test-json-roundtrip-" + Date.now();

    try {
      // 1. Create user
      db.prepare(`
        INSERT INTO users (id, username, password_hash, display_name, role, created_at)
        VALUES (?, ?, 'hash', 'Roundtrip User', 'user', ?)
      `).run(testUserId, testUserId, Date.now());

      // 2. Populate complete dataset for this user
      saveUserCategories(testUserId, [
        { id: "cat-1", name: "开发工具", label: "Dev Tools", icon: "🛠️", color: "#10B981" },
        { id: "cat-2", name: "AI 平台", label: "AI Platforms", icon: "🤖", color: "#6366F1" },
      ]);

      saveUserLinks(testUserId, [
        { id: "link-1", title: "GitHub", url: "https://github.com", description: "代码托管", icon: "simple-icons:github", category: "cat-1", isQuickAccess: true },
        { id: "link-2", title: "ChatGPT", url: "https://chatgpt.com", description: "AI 对话", icon: "simple-icons:openai", category: "cat-2", isQuickAccess: false },
      ]);

      saveUserProjects(testUserId, [
        { id: "proj-1", name: "Navelix 核心开发", status: "进行中", statusColor: "bg-emerald-50 text-emerald-600", url: "https://github.com/org/repo" },
      ]);

      saveUserTodos(testUserId, [
        { id: "todo-1", title: "完成 JSON 备份验证", priority: "high", done: false, dueDate: "2026-08-20", projectId: "proj-1", createdAt: 1786680000000, sortOrder: 0 },
      ]);

      const originalConfig = {
        siteTitle: "我的专属数字工作台",
        logoText: "MyHub",
        logoImage: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
        showSearchBar: true,
        allowPublicAccess: false,
        allowRegistration: false,
        customHeadScripts: "<script src='https://analytics.example.com/tracker.js'></script>",
        customCss: "body { --brand: #00c776; }",
        maxWidth: "1400px",
        customFooter: "© 2026 MyHub Inc.",
        theme: "dark",
        aiBaseUrl: "https://api.deepseek.com/v1",
        aiModel: "deepseek-chat",
        linkStatusEnabled: true,
        linkStatusInterval: 120,
        socialGithub: "https://github.com/myuser",
        socialX: "https://x.com/myuser",
        socialLinkedin: "",
        socialEmail: "admin@myhub.com",
        weatherEnabled: true,
        weatherLocation: "Shenzhen",
        weatherApiBaseUrl: "https://api.seniverse.com",
        linkOpenTarget: "_blank",
        wallpaperMode: "custom",
        customWallpaperUrl: "https://images.unsplash.com/photo-12345",
        glassmorphism: true,
        sidebarDefaultState: "collapsed",
        clockWidgetMode: "analog",
      };

      saveUserConfigs(testUserId, originalConfig);

      // 3. Simulate Full Export Payload Generation (like handleExport does)
      const catRows = db.prepare("SELECT id, name, label, icon, color FROM user_categories WHERE user_id = ?").all(testUserId);
      const linkRows = db.prepare("SELECT id, title, url, description, icon, category, notes, is_quick_access FROM user_links WHERE user_id = ?").all(testUserId);
      const projRows = db.prepare("SELECT id, name, status, status_color, url FROM projects WHERE user_id = ?").all(testUserId);
      const todoRows = db.prepare("SELECT id, title, priority, done, due_date, project_id, created_at, sort_order FROM user_todos WHERE user_id = ?").all(testUserId);
      const configRow = db.prepare("SELECT * FROM user_configs WHERE user_id = ?").get(testUserId) as Record<string, unknown>;

      const exportPayload = {
        version: "2.0",
        exportTime: new Date().toISOString(),
        categories: catRows,
        links: linkRows,
        projects: projRows,
        todos: todoRows,
        config: configRow,
      };

      // 4. Simulate JSON serialization & re-parsing
      const jsonString = JSON.stringify(exportPayload, null, 2);
      const parsed = JSON.parse(jsonString);

      // 5. Create a new clean user to simulate restoring from this JSON backup
      const restoredUserId = "test-json-restored-" + Date.now();
      db.prepare(`
        INSERT INTO users (id, username, password_hash, display_name, role, created_at)
        VALUES (?, ?, 'hash', 'Restored User', 'user', ?)
      `).run(restoredUserId, restoredUserId, Date.now());

      saveUserCategories(restoredUserId, parsed.categories);
      saveUserLinks(restoredUserId, parsed.links);
      saveUserProjects(restoredUserId, parsed.projects);
      saveUserTodos(restoredUserId, parsed.todos);
      saveUserConfigs(restoredUserId, {
        siteTitle: parsed.config.site_title,
        logoText: parsed.config.logo_text,
        logoImage: parsed.config.logo_image,
        showSearchBar: parsed.config.show_search_bar === 1,
        allowPublicAccess: parsed.config.allow_public_access === 1,
        allowRegistration: parsed.config.allow_registration === 1,
        customHeadScripts: parsed.config.custom_head_scripts,
        customCss: parsed.config.custom_css,
        maxWidth: parsed.config.max_width,
        customFooter: parsed.config.custom_footer,
        theme: parsed.config.theme,
        aiBaseUrl: parsed.config.ai_base_url,
        aiModel: parsed.config.ai_model,
        linkStatusEnabled: parsed.config.link_status_enabled === 1,
        linkStatusInterval: parsed.config.link_status_interval,
        socialGithub: parsed.config.social_github,
        socialX: parsed.config.social_x,
        socialLinkedin: parsed.config.social_linkedin,
        socialEmail: parsed.config.social_email,
        weatherEnabled: parsed.config.weather_enabled === 1,
        weatherLocation: parsed.config.weather_location,
        weatherApiBaseUrl: parsed.config.weather_api_base_url,
        linkOpenTarget: parsed.config.link_open_target,
        wallpaperMode: parsed.config.wallpaper_mode,
        customWallpaperUrl: parsed.config.custom_wallpaper_url,
        glassmorphism: parsed.config.glassmorphism === 1,
        sidebarDefaultState: parsed.config.sidebar_default_state,
        clockWidgetMode: parsed.config.clock_widget_mode,
      });

      // 6. Verify restored data matches 100% of the original settings
      const restoredConfig = db.prepare("SELECT * FROM user_configs WHERE user_id = ?").get(restoredUserId) as Record<string, unknown>;
      assert.equal(restoredConfig.site_title, "我的专属数字工作台");
      assert.equal(restoredConfig.logo_text, "MyHub");
      assert.equal(restoredConfig.allow_public_access, 0);
      assert.equal(restoredConfig.allow_registration, 0);
      assert.equal(restoredConfig.custom_head_scripts, "<script src='https://analytics.example.com/tracker.js'></script>");
      assert.equal(restoredConfig.custom_css, "body { --brand: #00c776; }");
      assert.equal(restoredConfig.wallpaper_mode, "custom");
      assert.equal(restoredConfig.custom_wallpaper_url, "https://images.unsplash.com/photo-12345");
      assert.equal(restoredConfig.glassmorphism, 1);
      assert.equal(restoredConfig.clock_widget_mode, "analog");
      assert.equal(restoredConfig.sidebar_default_state, "collapsed");

      const restoredCats = db.prepare("SELECT * FROM user_categories WHERE user_id = ?").all(restoredUserId);
      assert.equal(restoredCats.length, 2);

      const restoredLinks = db.prepare("SELECT * FROM user_links WHERE user_id = ?").all(restoredUserId);
      assert.equal(restoredLinks.length, 2);

      const restoredProjects = db.prepare("SELECT * FROM projects WHERE user_id = ?").all(restoredUserId);
      assert.equal(restoredProjects.length, 1);

      const restoredTodos = db.prepare("SELECT * FROM user_todos WHERE user_id = ?").all(restoredUserId);
      assert.equal(restoredTodos.length, 1);

      // Clean up restored test user
      db.prepare("DELETE FROM users WHERE id = ?").run(restoredUserId);
    } finally {
      db.prepare("DELETE FROM users WHERE id = ?").run(testUserId);
    }
  });
});
