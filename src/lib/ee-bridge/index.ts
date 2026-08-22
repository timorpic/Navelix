import type { IStorageProviderDriver, ILinkProbeDriver, TelemetrySecret } from "./types.ts";
import { NullStorageDriver, NullLinkProbeDriver, CE_PRO_MESSAGE } from "./stubs.ts";

export interface EEDriverRegistry {
  storageDriver?: IStorageProviderDriver;
  probeDriver?: ILinkProbeDriver;
  officialPublicKey?: string;
  /** 遥测敏感配置（端点 + TOKEN），由 ee 字节码制品注入；对所有实例可用（不依赖激活码） */
  telemetrySecret?: TelemetrySecret;
}

const GLOBAL_EE_KEY = Symbol.for("navelix.ee.drivers");

function getGlobalRegistry(): EEDriverRegistry | null {
  const g = globalThis as unknown as Record<symbol, EEDriverRegistry | undefined>;
  return g[GLOBAL_EE_KEY] || null;
}

export function registerEEDrivers(drivers: EEDriverRegistry): void {
  const g = globalThis as unknown as Record<symbol, EEDriverRegistry | undefined>;
  g[GLOBAL_EE_KEY] = {
    ...g[GLOBAL_EE_KEY],
    ...drivers,
  };
}

export function isEEAvailable(): boolean {
  const reg = getGlobalRegistry();
  return Boolean(reg?.storageDriver && reg?.probeDriver);
}

export function getStorageDriver(): IStorageProviderDriver {
  const reg = getGlobalRegistry();
  if (reg?.storageDriver) {
    return reg.storageDriver;
  }
  return new NullStorageDriver();
}

export function getProbeDriver(): ILinkProbeDriver {
  const reg = getGlobalRegistry();
  if (reg?.probeDriver) {
    return reg.probeDriver;
  }
  return new NullLinkProbeDriver();
}

export function getOfficialEELicenseKey(): string {
  const reg = getGlobalRegistry();
  return reg?.officialPublicKey || "";
}

/**
 * 获取遥测敏感配置（端点 + TOKEN）。
 * 注意：与 isEEAvailable() 无关——遥测上报应对所有实例（CE/Pro）全量运行，
 * 因此只要字节码制品注入即可读取，不检查激活码。
 */
export function getTelemetrySecret(): TelemetrySecret | null {
  const reg = getGlobalRegistry();
  return reg?.telemetrySecret || null;
}

export { CE_PRO_MESSAGE };
export * from "./types.ts";
