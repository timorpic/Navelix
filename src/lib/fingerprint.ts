import crypto from "node:crypto";
import os from "node:os";
import { db } from "./db.ts";

const FINGERPRINT_SALT = "navelix-device-instance-fingerprint-salt-v1";

/**
 * 获取或生成当前实例的持久化唯一设备种子 (Seed)
 * 存储在 SQLite system_settings 中，保证 Docker 容器重启/升级不丢指纹
 */
function getOrGeneratePersistentSeed(): string {
  try {
    const row = db
      .prepare("SELECT value FROM system_settings WHERE key = 'instance_device_seed'")
      .get() as { value: string } | undefined;

    if (row?.value && row.value.trim().length > 0) {
      return row.value.trim();
    }

    const newSeed = crypto.randomBytes(32).toString("hex");
    db.prepare(
      "INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES ('instance_device_seed', ?, ?)",
    ).run(newSeed, Date.now());
    return newSeed;
  } catch {
    return "navelix-default-fallback-seed";
  }
}

/**
 * 计算当前部署实例的机器/安装指纹
 * 结合：DB持久化种子 + 操作系统平台 + CPU架构 + 主机特征
 * 输出标准格式：NVX-FP-XXXX-XXXX-XXXX-XXXX
 */
export function getMachineFingerprint(): string {
  const seed = getOrGeneratePersistentSeed();
  const platform = process.platform;
  const arch = process.arch;
  const hostname = os.hostname() || "localhost";
  const cpus = os.cpus();
  const cpuModel = cpus && cpus[0]?.model ? cpus[0].model : "unknown-cpu";

  const rawInfo = `${seed}|${platform}|${arch}|${hostname}|${cpuModel}|${FINGERPRINT_SALT}`;
  const hash = crypto.createHmac("sha256", FINGERPRINT_SALT).update(rawInfo).digest("hex").toUpperCase();

  // 截取 16 位大写十六进制字符，格式化为 4x4 代码块：NVX-FP-XXXX-XXXX-XXXX-XXXX
  const part1 = hash.slice(0, 4);
  const part2 = hash.slice(4, 8);
  const part3 = hash.slice(8, 12);
  const part4 = hash.slice(12, 16);

  return `NVX-FP-${part1}-${part2}-${part3}-${part4}`;
}
