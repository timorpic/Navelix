import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_CLOUD_STORAGE_CONFIG,
  buildLicenseActivationPayload,
  formatBackupSize,
  licenseBadgeKind,
  licenseExpiryLabel,
  licensePlanLabel,
  licenseSummaryLine,
  licenseTitle,
  parseLicenseActivationResult,
  parseLicenseStatus,
  parseRemoteBackupList,
  parseStorageConfig,
  parseStorageRestoreResult,
  storageBackupMessage,
  storageSaveMessage,
  storageTestMessage,
  storageTypePatch,
} from "../admin-pro.ts";

/**
 * 「Pro 商业授权」Tab 纯逻辑单测。
 *
 * 这些函数原先内联在 `admin-pro-tab.tsx`（1018 行的巨石组件）里：
 * 授权状态与云存储响应的解析、激活请求体组装、快照条目格式化
 * 都无法被测试覆盖。抽出到 lib 后在此固定住行为，防止后续重构
 * 悄悄改变判定顺序、提示文案或回退值。
 */

describe("admin-pro: licenseTitle / licenseBadgeKind", () => {
  it("标题按 Pro → 官方镜像 → 源码开发版 判定", () => {
    assert.equal(licenseTitle({ isPro: true }), "Navelix Pro 商业版");
    assert.equal(
      licenseTitle({ isPro: false, isDockerBuild: true }),
      "Navelix 官方镜像版",
    );
    assert.equal(licenseTitle({ isPro: false }), "Navelix 源码开发版");
  });

  it("徽标分支顺序为 pro → docker → ee → source，Pro 优先于镜像版", () => {
    assert.equal(licenseBadgeKind({ isPro: true, isDockerBuild: true }), "pro");
    assert.equal(licenseBadgeKind({ isPro: false, isDockerBuild: true, isEE: true }), "docker");
    assert.equal(licenseBadgeKind({ isPro: false, isEE: true }), "ee");
    assert.equal(licenseBadgeKind({ isPro: false }), "source");
  });
});

describe("admin-pro: licensePlanLabel / licenseExpiryLabel", () => {
  it("pro_lifetime 为终身买断，其余（含缺失）一律高级订阅", () => {
    assert.equal(licensePlanLabel({ plan: "pro_lifetime" } as never), "终身买断");
    assert.equal(licensePlanLabel({ plan: "pro_yearly" } as never), "高级订阅");
    assert.equal(licensePlanLabel(undefined), "高级订阅");
  });

  it("expiresAt 为 0 时视为永久，缺失时按 0 处理（与原实现一致）", () => {
    assert.equal(licenseExpiryLabel(0), "永久有效 (Lifetime)");
    assert.equal(licenseExpiryLabel(undefined), new Date(0).toLocaleDateString());
    assert.equal(
      licenseExpiryLabel(1700000000000),
      new Date(1700000000000).toLocaleDateString(),
    );
  });

  it("授权信息行拼接客户 / 有效期 / 席位，席位缺失回退 1", () => {
    assert.equal(
      licenseSummaryLine({
        licenseId: "L1",
        customer: "示例科技",
        email: "ops@example.com",
        plan: "pro_lifetime",
        features: [],
        expiresAt: 0,
      }),
      "授权客户：示例科技 (ops@example.com) · 有效期：永久有效 (Lifetime) · 席位配额：1 人",
    );
    assert.match(
      licenseSummaryLine({
        licenseId: "L2",
        customer: "A",
        email: "a@b.c",
        plan: "pro",
        features: [],
        expiresAt: 0,
        maxSeats: 5,
      }),
      /席位配额：5 人$/,
    );
  });
});

describe("admin-pro: parseLicenseStatus", () => {
  it("透传整个响应对象，并单独取出机器指纹", () => {
    const parsed = parseLicenseStatus({
      isPro: true,
      isEE: true,
      machineFingerprint: "ABC-123",
    });
    assert.equal(parsed?.status.isPro, true);
    assert.equal(parsed?.machineFingerprint, "ABC-123");
  });

  it("指纹缺失时为空串（原实现仅在字段存在时覆盖 state）", () => {
    assert.equal(parseLicenseStatus({ isPro: false })?.machineFingerprint, "");
  });

  it("非对象响应视为无效", () => {
    assert.equal(parseLicenseStatus(null), null);
    assert.equal(parseLicenseStatus("nope"), null);
  });
});

describe("admin-pro: buildLicenseActivationPayload", () => {
  it("去除首尾空白后作为 licenseKey", () => {
    assert.deepEqual(buildLicenseActivationPayload("  eyJsaWNlbnNl...  "), {
      licenseKey: "eyJsaWNlbnNl...",
    });
  });

  it("空串与纯空白返回 null（调用方不发起请求）", () => {
    assert.equal(buildLicenseActivationPayload(""), null);
    assert.equal(buildLicenseActivationPayload("   \n "), null);
  });
});

describe("admin-pro: parseLicenseActivationResult", () => {
  it("HTTP 成功且 isPro 为真才算激活成功", () => {
    const outcome = parseLicenseActivationResult(true, { isPro: true });
    assert.equal(outcome.ok, true);
  });

  it("HTTP 失败或 isPro 缺失时给出失败文案，回退「许可证无效」", () => {
    const failed = parseLicenseActivationResult(false, { isPro: true });
    assert.deepEqual(failed, { ok: false, message: "❌ 激活失败：许可证无效" });
    assert.deepEqual(parseLicenseActivationResult(true, { isPro: false, error: "签名错误" }), {
      ok: false,
      message: "❌ 激活失败：签名错误",
    });
  });
});

describe("admin-pro: 云存储配置", () => {
  it("默认配置与原内联 useState 初值一致", () => {
    assert.deepEqual(DEFAULT_CLOUD_STORAGE_CONFIG, {
      enabled: false,
      type: "none",
      s3Endpoint: "",
      s3Region: "us-east-1",
      s3Bucket: "",
      s3AccessKey: "",
      s3SecretKey: "",
      s3PathPrefix: "navelix-backups/",
      s3ForcePathStyle: false,
      webdavUrl: "",
      webdavUsername: "",
      webdavPassword: "",
      autoBackupDaily: true,
      keepCopies: 7,
    });
  });

  it("parseStorageConfig 透传对象、拒绝非对象", () => {
    assert.deepEqual(parseStorageConfig({ type: "s3", isPro: true }), {
      type: "s3",
      isPro: true,
    });
    assert.equal(parseStorageConfig(null), null);
    assert.equal(parseStorageConfig(42), null);
  });

  it("切换存储类型时 enabled 由「是否关闭云备份」推导", () => {
    assert.deepEqual(
      storageTypePatch(DEFAULT_CLOUD_STORAGE_CONFIG, "s3"),
      { ...DEFAULT_CLOUD_STORAGE_CONFIG, type: "s3", enabled: true },
    );
    assert.deepEqual(
      storageTypePatch({ ...DEFAULT_CLOUD_STORAGE_CONFIG, type: "s3" }, "none"),
      { ...DEFAULT_CLOUD_STORAGE_CONFIG, type: "none", enabled: false },
    );
  });
});

describe("admin-pro: 云存储接口提示文案", () => {
  it("保存成功优先用服务端 message，失败带 error", () => {
    assert.equal(storageSaveMessage(true, { message: "已保存" }), "已保存");
    assert.equal(storageSaveMessage(true, {}), "云存储配置保存成功！");
    assert.equal(storageSaveMessage(false, { error: "权限不足" }), "❌ 保存失败: 权限不足");
  });

  it("连通性测试成功优先用 message，失败回退 message 再回退 error", () => {
    assert.equal(storageTestMessage(true, { success: true, message: "RTT 12ms" }), "RTT 12ms");
    assert.equal(storageTestMessage(true, { success: true }), "🎉 连接测试成功！");
    assert.equal(
      storageTestMessage(false, { message: "连接超时", error: "ETIMEDOUT" }),
      "❌ 连通性测试失败: 连接超时",
    );
    assert.equal(
      storageTestMessage(true, { success: false, error: "签名不匹配" }),
      "❌ 连通性测试失败: 签名不匹配",
    );
  });

  it("立即备份成功优先用 message，失败只看 error", () => {
    assert.equal(storageBackupMessage(true, { success: true, message: "已上传 3 份" }), "已上传 3 份");
    assert.equal(storageBackupMessage(true, { success: true }), "🎉 成功备份并上传至云存储！");
    assert.equal(storageBackupMessage(false, { error: "存储不可写" }), "❌ 备份失败: 存储不可写");
  });
});

describe("admin-pro: parseRemoteBackupList", () => {
  it("HTTP 成功且 backups 为数组时返回列表", () => {
    const list = [{ name: "a.db", size: 2048, lastModified: "2026-01-01T00:00:00Z" }];
    assert.deepEqual(parseRemoteBackupList(true, { backups: list }), list);
  });

  it("backups 非数组或 HTTP 失败时返回 null（原实现不更新列表）", () => {
    assert.equal(parseRemoteBackupList(true, { backups: "nope" }), null);
    assert.equal(parseRemoteBackupList(true, {}), null);
    assert.equal(parseRemoteBackupList(false, { backups: [] }), null);
  });
});

describe("admin-pro: parseStorageRestoreResult", () => {
  it("HTTP 成功且 success 为真时视为还原成功", () => {
    assert.deepEqual(parseStorageRestoreResult(true, { success: true }), { ok: true });
  });

  it("失败时给出还原失败文案", () => {
    assert.deepEqual(parseStorageRestoreResult(false, { error: "快照损坏" }), {
      ok: false,
      message: "❌ 还原失败: 快照损坏",
    });
  });
});

describe("admin-pro: 快照条目格式化", () => {
  it("体积固定按 KB 保留一位小数", () => {
    assert.equal(formatBackupSize(0), "0.0 KB");
    assert.equal(formatBackupSize(2048), "2.0 KB");
    assert.equal(formatBackupSize(1536), "1.5 KB");
  });
});
