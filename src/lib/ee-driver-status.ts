/** Public diagnostics only: no keys, endpoints, driver objects or raw loader errors. */
export type EEDriverState = "loaded" | "partial" | "missing" | "failed" | "unknown";
export type EELoadFailure = "incompatible-runtime" | "loader-unavailable" | "load-error";
export interface EEDriverStatus {
  state: EEDriverState;
  storageRegistered: boolean;
  probeRegistered: boolean;
  failure: EELoadFailure | null;
}

export function parseEEDriverStatus(value: unknown): EEDriverStatus | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.state !== "string" || !["loaded", "partial", "missing", "failed", "unknown"].includes(row.state) ||
    typeof row.storageRegistered !== "boolean" || typeof row.probeRegistered !== "boolean" ||
    (row.failure !== null && (typeof row.failure !== "string" || !["incompatible-runtime", "loader-unavailable", "load-error"].includes(row.failure)))) return null;
  return { state: row.state as EEDriverState, storageRegistered: row.storageRegistered,
    probeRegistered: row.probeRegistered, failure: row.failure as EELoadFailure | null };
}

export function eeDriverStatusLabel(state: EEDriverState): string {
  return { loaded: "已加载", partial: "驱动注册不完整", missing: "未包含 EE 驱动", failed: "加载失败", unknown: "加载状态未知" }[state];
}
export function eeDriverStatusDescription(status: EEDriverStatus): string {
  if (status.state === "loaded") return "存储与网络探针驱动均已注册，具体功能仍需相应许可证授权。";
  if (status.state === "partial") return "驱动注册不完整，请检查制品及服务启动日志。";
  if (status.state === "missing") return "当前构建未包含 EE 驱动制品；使用对应官方镜像后重启服务可重新检测。";
  if (status.state === "unknown") return "尚未获得启动加载结果，请刷新状态或检查服务启动日志。";
  if (status.failure === "incompatible-runtime") return "制品与当前 Node/V8 版本不兼容，请在目标 Node 版本下重新编译制品并重启服务。";
  if (status.failure === "loader-unavailable") return "当前运行环境无法使用字节码加载器，请检查 Node.js 版本及启动日志。";
  return "驱动制品加载失败，请检查服务启动日志并在修复后重启服务。";
}
