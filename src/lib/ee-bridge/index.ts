import type { IStorageProviderDriver, ILinkProbeDriver } from "./types.ts";
import { NullStorageDriver, NullLinkProbeDriver, CE_PRO_MESSAGE } from "./stubs.ts";

export interface EEDriverRegistry {
  storageDriver?: IStorageProviderDriver;
  probeDriver?: ILinkProbeDriver;
  officialPublicKey?: string;
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

export { CE_PRO_MESSAGE };
export * from "./types.ts";
