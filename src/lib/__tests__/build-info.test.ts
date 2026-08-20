import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { getBuildInfo } from "../build-info.ts";

describe("Application Build Info & Metadata Integrity", () => {
  it("should return default build info when no file or env is present", () => {
    const info = getBuildInfo();
    assert.ok(info.version);
    assert.equal(typeof info.isDockerBuild, "boolean");
  });

  it("should prioritize physical build-info.json over outdated environment variables", () => {
    const tmpBuildInfoPath = path.join(process.cwd(), "public", "build-info.json");
    const testData = {
      version: "1.2.3-test",
      sourceSha: "sha-test999",
      buildDate: "2026-08-20T17:55:00.000Z",
    };

    const originalEnvSha = process.env.NAVELIX_SOURCE_SHA;
    const originalEnvDate = process.env.NAVELIX_BUILD_DATE;

    try {
      // 模拟旧环境变量 (8/17)
      process.env.NAVELIX_SOURCE_SHA = "sha-e346029";
      process.env.NAVELIX_BUILD_DATE = "2026-08-17T14:43:55.000Z";

      // 模拟磁盘上最新烘焙的 build-info.json
      fs.writeFileSync(tmpBuildInfoPath, JSON.stringify(testData), "utf8");

      const info = getBuildInfo();
      assert.equal(info.version, "1.2.3-test", "应优先读取磁盘中的真实构建版本");
      assert.equal(info.sourceSha, "sha-test999", "应优先读取磁盘中的最新 SHA");
      assert.equal(info.buildDate, "2026-08-20T17:55:00.000Z", "应优先读取磁盘中的真实构建时间");
    } finally {
      if (fs.existsSync(tmpBuildInfoPath)) {
        fs.unlinkSync(tmpBuildInfoPath);
      }
      if (originalEnvSha !== undefined) {
        process.env.NAVELIX_SOURCE_SHA = originalEnvSha;
      } else {
        delete process.env.NAVELIX_SOURCE_SHA;
      }
      if (originalEnvDate !== undefined) {
        process.env.NAVELIX_BUILD_DATE = originalEnvDate;
      } else {
        delete process.env.NAVELIX_BUILD_DATE;
      }
    }
  });
});
