import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildTelegramPayload,
  parseProfileSaveResult,
  parseProfileUser,
  parseReportConfig,
  parseReportSaveResult,
  parseTelegramConfig,
  parseTelegramSaveResult,
  profileInputsFrom,
  profileNoticeColor,
  sessionLabel,
  validatePasswordChange,
} from "../admin-profile.ts";

/**
 * 「个人账号与安全」Tab 纯逻辑单测。
 *
 * 这些函数原先内联在 `admin-profile-tab.tsx`（1219 行的巨石组件）里：
 * 改密校验的三条分支、四个接口响应的解析、Telegram 保存载荷与提示颜色判定
 * 都无法被测试覆盖。抽出到 lib 后在此固定住行为，防止后续重构
 * 悄悄改变校验顺序、提示文案或回退值。
 */

describe("admin-profile: sessionLabel", () => {
  it("按 UA 关键字映射设备名，顺序为 Chrome → Safari → Firefox", () => {
    assert.equal(sessionLabel("Mozilla/5.0 Chrome/120"), "🌐 Chrome 浏览器");
    assert.equal(sessionLabel("Mozilla/5.0 Safari/605"), "🧭 Safari 浏览器");
    assert.equal(sessionLabel("Mozilla/5.0 Firefox/121"), "🦊 Firefox 浏览器");
  });

  it("Chrome UA 里同时含 Safari 时优先判为 Chrome（与内联实现一致）", () => {
    assert.equal(
      sessionLabel("Mozilla/5.0 (Macintosh) Chrome/120 Safari/537.36"),
      "🌐 Chrome 浏览器",
    );
  });

  it("无法识别时回退为桌面端终端设备", () => {
    assert.equal(sessionLabel("curl/8.0"), "💻 桌面端终端设备");
    assert.equal(sessionLabel(""), "💻 桌面端终端设备");
  });
});

describe("admin-profile: profileNoticeColor", () => {
  it("以 🎉 开头视为成功，使用品牌绿", () => {
    assert.equal(profileNoticeColor("🎉 密码修改成功！"), "#00C776");
  });

  it("其余一律视为失败，使用玫红", () => {
    assert.equal(profileNoticeColor("❌ 密码修改失败"), "#F43F5E");
    assert.equal(profileNoticeColor(""), "#F43F5E");
  });
});

describe("admin-profile: validatePasswordChange", () => {
  const valid = {
    oldPassword: "oldpass",
    newPassword: "newpass1",
    confirmPassword: "newpass1",
  };

  it("三项都合法时通过", () => {
    assert.deepEqual(validatePasswordChange(valid), { ok: true });
  });

  it("原密码为空时先报原密码缺失", () => {
    assert.deepEqual(validatePasswordChange({ ...valid, oldPassword: "" }), {
      ok: false,
      message: "❌ 请输入当前原密码",
    });
  });

  it("新密码短于 6 位时（含空串）报长度不足", () => {
    for (const newPassword of ["", "12345"]) {
      assert.deepEqual(
        validatePasswordChange({ ...valid, newPassword, confirmPassword: newPassword }),
        { ok: false, message: "❌ 新密码长度至少需 6 位" },
      );
    }
  });

  it("恰好 6 位视为合法（边界）", () => {
    assert.deepEqual(
      validatePasswordChange({ ...valid, newPassword: "123456", confirmPassword: "123456" }),
      { ok: true },
    );
  });

  it("两次新密码不一致时报确认不一致", () => {
    assert.deepEqual(
      validatePasswordChange({ ...valid, confirmPassword: "newpass2" }),
      { ok: false, message: "❌ 两次输入的二次确认新密码不一致，请重新检查" },
    );
  });

  it("校验顺序：原密码缺失优先于长度与一致性检查", () => {
    assert.deepEqual(
      validatePasswordChange({ oldPassword: "", newPassword: "1", confirmPassword: "2" }),
      { ok: false, message: "❌ 请输入当前原密码" },
    );
  });
});

describe("admin-profile: profileInputsFrom", () => {
  it("displayName 缺失时回退到 username", () => {
    assert.deepEqual(profileInputsFrom({ username: "alex" }), {
      displayName: "alex",
      email: "",
      bio: "",
    });
  });

  it("优先使用 displayName，并原样带出 email / bio", () => {
    assert.deepEqual(
      profileInputsFrom({
        username: "alex",
        displayName: "亚历克斯",
        email: "a@b.c",
        bio: "极客致远",
      }),
      { displayName: "亚历克斯", email: "a@b.c", bio: "极客致远" },
    );
  });

  it("字段为 null / undefined 时统一回退为空串", () => {
    assert.deepEqual(profileInputsFrom({}), {
      displayName: "",
      email: "",
      bio: "",
    });
  });
});

describe("admin-profile: parseProfileUser", () => {
  it("取出 user 对象", () => {
    const user = { username: "alex", displayName: "A", role: "admin" as const };
    assert.deepEqual(parseProfileUser({ user }), user);
  });

  it("user 缺失或响应非对象时返回 null", () => {
    assert.equal(parseProfileUser({}), null);
    assert.equal(parseProfileUser({ user: null }), null);
    assert.equal(parseProfileUser(null), null);
    assert.equal(parseProfileUser("nope"), null);
  });
});

describe("admin-profile: parseProfileSaveResult", () => {
  const user = { username: "alex", displayName: "A", role: "admin" as const };

  it("成功时用服务端 message 组装 🎉 提示", () => {
    assert.deepEqual(parseProfileSaveResult(true, { user, message: "已保存" }), {
      ok: true,
      user,
      notice: "🎉 已保存",
    });
  });

  it("成功但无 message 时回退为「个人资料更新成功」", () => {
    assert.deepEqual(parseProfileSaveResult(true, { user }), {
      ok: true,
      user,
      notice: "🎉 个人资料更新成功",
    });
  });

  it("失败时用服务端 error 组装 ❌ 提示", () => {
    assert.deepEqual(parseProfileSaveResult(false, { error: "邮箱已被占用" }), {
      ok: false,
      notice: "❌ 邮箱已被占用",
    });
  });

  it("失败且无 error 时回退为「修改失败」", () => {
    assert.deepEqual(parseProfileSaveResult(false, {}), {
      ok: false,
      notice: "❌ 修改失败",
    });
    assert.deepEqual(parseProfileSaveResult(true, {}), {
      ok: false,
      notice: "❌ 修改失败",
    });
  });
});

describe("admin-profile: parseTelegramConfig", () => {
  const payload = {
    status: {
      enabled: true,
      notifyBackup: false,
      notifySystem: true,
      configured: true,
      chatIdConfigured: false,
    },
    chatId: "123456789",
  };

  it("逐字段取出 status 与 chatId", () => {
    assert.deepEqual(parseTelegramConfig(payload), {
      enabled: true,
      notifyBackup: false,
      notifySystem: true,
      botTokenConfigured: true,
      chatId: "123456789",
      chatIdConfigured: false,
    });
  });

  it("chatId 非字符串时回退为空串", () => {
    assert.equal(parseTelegramConfig({ ...payload, chatId: null })?.chatId, "");
  });

  it("缺少 status 或响应非对象时返回 null（视为无效响应）", () => {
    assert.equal(parseTelegramConfig({ chatId: "1" }), null);
    assert.equal(parseTelegramConfig(null), null);
    assert.equal(parseTelegramConfig("nope"), null);
  });
});

describe("admin-profile: parseTelegramSaveResult", () => {
  it("取出两个「已配置」标记", () => {
    assert.deepEqual(
      parseTelegramSaveResult({ status: { configured: true, chatIdConfigured: false } }),
      { botTokenConfigured: true, chatIdConfigured: false },
    );
  });

  it("缺少 status 或响应非对象时返回 null", () => {
    assert.equal(parseTelegramSaveResult({}), null);
    assert.equal(parseTelegramSaveResult({ status: null }), null);
    assert.equal(parseTelegramSaveResult(undefined), null);
  });
});

describe("admin-profile: buildTelegramPayload", () => {
  const draft = {
    botToken: "tok",
    chatId: "123",
    enabled: true,
    notifyBackup: true,
    notifySystem: false,
  };

  it("传入 patch 时原样提交 patch", () => {
    assert.deepEqual(buildTelegramPayload(draft, { enabled: false }), { enabled: false });
    assert.deepEqual(buildTelegramPayload(draft, { chatId: "999" }), { chatId: "999" });
  });

  it("无 patch 时回退为整份表单快照", () => {
    assert.deepEqual(buildTelegramPayload(draft), {
      botToken: "tok",
      chatId: "123",
      enabled: true,
      notifyBackup: true,
      notifySystem: false,
    });
  });

  it("空 patch 对象不会被当作「无 patch」而回退", () => {
    assert.deepEqual(buildTelegramPayload(draft, {}), {});
  });
});

describe("admin-profile: parseReportConfig", () => {
  it("enabled 为布尔时取出开关与端点标记", () => {
    assert.deepEqual(parseReportConfig({ enabled: false, endpointConfigured: true }), {
      enabled: false,
      endpointConfigured: true,
    });
  });

  it("endpointConfigured 缺失时回退为 false", () => {
    assert.deepEqual(parseReportConfig({ enabled: true }), {
      enabled: true,
      endpointConfigured: false,
    });
  });

  it("enabled 非布尔或响应非对象时返回 null", () => {
    assert.equal(parseReportConfig({ enabled: "yes" }), null);
    assert.equal(parseReportConfig({}), null);
    assert.equal(parseReportConfig(null), null);
  });
});

describe("admin-profile: parseReportSaveResult", () => {
  it("success 为真时返回服务端确认的 enabled", () => {
    assert.equal(parseReportSaveResult({ success: true, enabled: false }), false);
    assert.equal(parseReportSaveResult({ success: true, enabled: true }), true);
  });

  it("success 为真但 enabled 缺失时回退为 false", () => {
    assert.equal(parseReportSaveResult({ success: true }), false);
  });

  it("success 非真或响应非对象时返回 null", () => {
    assert.equal(parseReportSaveResult({ success: false, enabled: true }), null);
    assert.equal(parseReportSaveResult({ enabled: true }), null);
    assert.equal(parseReportSaveResult(null), null);
  });
});
