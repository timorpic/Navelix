import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getCloudStorageConfig,
  saveCloudStorageConfig,
  testStorageConnection,
  type CloudStorageConfig,
} from "../storage-provider.ts";
import { isEEAvailable, getStorageDriver } from "../ee-bridge/index.ts";

describe("Cloud Storage Provider & Open-Core EE Bridge Architecture", () => {
  it("should verify storage driver bridge functionality", async () => {
    const driver = getStorageDriver();
    assert.ok(driver, "应当提供合法的存储驱动接口实例");

    const result = await driver.testConnection({
      enabled: false,
      type: "none",
    });
    assert.equal(result.success, false);
  });

  it("should securely encrypt and decrypt cloud credentials in database", () => {
    const testConfig: CloudStorageConfig = {
      enabled: true,
      type: "s3",
      s3Endpoint: "https://s3.us-east-1.amazonaws.com",
      s3Bucket: "navelix-encrypted-bucket",
      s3AccessKey: "MY_ACCESS_KEY_123",
      s3SecretKey: "TOP_SECRET_PASSWORD_XYZ!@#",
      s3Region: "us-east-1",
      webdavUrl: "https://dav.example.com/dav/",
      webdavUsername: "user",
      webdavPassword: "DAV_SECRET_PASSWORD_123",
      autoBackupDaily: true,
      keepCopies: 14,
    };

    // 保存配置
    saveCloudStorageConfig(testConfig);

    // 读取配置并解密
    const retrieved = getCloudStorageConfig();
    assert.equal(retrieved.enabled, true);
    assert.equal(retrieved.type, "s3");
    assert.equal(retrieved.s3Bucket, "navelix-encrypted-bucket");
    assert.equal(retrieved.s3AccessKey, "MY_ACCESS_KEY_123");
    assert.equal(retrieved.s3SecretKey, "TOP_SECRET_PASSWORD_XYZ!@#", "S3 私密密钥解密应当与原文一致");
    assert.equal(retrieved.webdavPassword, "DAV_SECRET_PASSWORD_123", "WebDAV 密码解密应当与原文一致");
    assert.equal(retrieved.keepCopies, 14);
  });

  it("should correctly identify EE driver availability and bridge operations", async () => {
    const available = isEEAvailable();
    assert.equal(typeof available, "boolean");
    const testCfg: CloudStorageConfig = {
      enabled: false,
      type: "none",
    };
    const res = await testStorageConnection(testCfg);
    assert.equal(res.success, false);
  });
});
