import type { SystemConfig } from "@/types";
import { canAccessFeature } from "./license.ts";
import { isEEAvailable } from "./ee-bridge/index.ts";
import { DEFAULT_SITE_TITLE } from "./constants.ts";

/**
 * EE / Pro 商业特性门禁 —— 单一事实来源。
 *
 * 历史问题：同一套降级规则散落在 5 处（user/data 读门禁、user/data 写门禁、
 * admin/backup 还原门禁、admin/storage 还原门禁，以及**缺失的** SSR 读路径）。
 * 更严重的是 `(app)/layout.tsx` 直接调用 `getUserData()`，绕过了 API 侧唯一的
 * 收口，导致 CE 环境下 Pro 字段在服务端渲染时照常下发。本模块统一读路径。
 *
 * 约定：本文件不构造 NextResponse（与 csrf.ts 一致），只返回标志位与纯函数，
 * 由调用方组装响应或 SQL。
 */

export interface ProFeatureFlags {
  /** 自定义 head 脚本 / CSS 注入（绕过 CSP，安全敏感） */
  hasCodeInject: boolean;
  /** 品牌定制：logoText / logoImage / siteTitle */
  hasBrandCustom: boolean;
  /** 链接存活与延迟探针 */
  hasProbes: boolean;
}

/**
 * 读取三项 Pro 特性授权状态。
 * 无 EE 驱动（本仓库即为 CE 构建）时三项恒为 false。
 */
export function getProFeatureFlags(): ProFeatureFlags {
  const ee = isEEAvailable();
  return {
    hasCodeInject: ee && canAccessFeature("custom_code_injection"),
    hasBrandCustom: ee && canAccessFeature("brand_customization"),
    hasProbes: ee && canAccessFeature("link_status_monitor"),
  };
}

/**
 * 将 EE 降级规则应用到 config 对象（就地修改并返回，便于链式调用）。
 *
 * 无授权时强制回落为安全默认值：
 * - 品牌定制 → Navelix 默认品牌
 * - 代码注入 → 清空（这是绕过 CSP 的注入点，务必清空）
 * - 探针 → 关闭并复位默认间隔
 */
export function applyEEGateToConfig<T extends Partial<SystemConfig>>(config: T): T {
  const { hasCodeInject, hasBrandCustom, hasProbes } = getProFeatureFlags();

  if (!hasBrandCustom) {
    config.logoText = "Navelix";
    config.logoImage = "";
    config.siteTitle = DEFAULT_SITE_TITLE;
  }
  if (!hasCodeInject) {
    config.customHeadScripts = "";
    config.customCss = "";
  }
  if (!hasProbes) {
    config.linkStatusEnabled = false;
    config.linkStatusInterval = 60;
  }

  return config;
}
