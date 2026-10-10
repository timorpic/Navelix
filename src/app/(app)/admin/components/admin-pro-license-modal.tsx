"use client";

import BrandLogo from "@/components/brand-logo";
import type { UseAdminLicenseResult } from "@/hooks/use-admin-license";

/**
 * 「Pro 商业授权」Tab 的弹窗 1：💎 License 激活弹窗。
 *
 * 从 `admin-pro-tab.tsx`（原 1018 行）抽出 —— 弹窗的开关、密钥输入、
 * 机器指纹与激活请求全部来自 `useAdminLicense()`，本组件只负责渲染。
 *
 * 遮罩仍沿用原手写的 `bg-black/60 backdrop-blur-xs`：`Overlay` 收敛的是
 * 另一套 `bg-black/50` 遮罩，改用它等于改变观感（同 `overlay.tsx` 文档里
 * 对 `Modal` 的取舍）。复制指纹的提示也走父组件的 `flash`，
 * 以便与其余提示共用同一个 Toast。
 */
export default function AdminProLicenseModal({
  license,
}: {
  license: UseAdminLicenseResult;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-gray-100 dark:border-slate-800 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white dark:bg-[#080B0F] border border-emerald-200/90 dark:border-emerald-500/30 p-2 flex items-center justify-center shrink-0 shadow-sm ring-2 ring-emerald-500/20">
              <BrandLogo />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                激活 Navelix Pro 高级功能
              </h3>
              <p className="text-xs text-gray-400 dark:text-slate-400">
                输入您购买的 License Key 离线激活
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={license.closeLicenseModal}
            className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-400 hover:text-gray-700 dark:hover:text-white flex items-center justify-center text-sm font-bold transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={license.activateLicense} className="space-y-4">
          <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-slate-800/90 border border-gray-200/80 dark:border-slate-700 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-gray-700 dark:text-slate-300 flex items-center gap-1.5">
                <span>🆔</span>
                <span>本机安装指纹 (Instance Fingerprint)</span>
              </span>
              <button
                type="button"
                onClick={license.copyFingerprint}
                className="text-[11px] text-[#00C776] hover:underline font-bold cursor-pointer"
              >
                一键复制指纹
              </button>
            </div>
            <div className="font-mono text-xs font-black text-gray-900 dark:text-white bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-gray-200 dark:border-slate-800 break-all select-all tracking-wider text-center">
              {license.machineFingerprint || "正在计算中…"}
            </div>
            <p className="text-[10px] text-gray-400 dark:text-slate-400 leading-normal">
              💡 获取 Pro 专属授权码时，请提供上述安装指纹。签发的密钥将与您的专属实例绑定。
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1.5">
              商业许可证密钥 (License Key)
            </label>
            <textarea
              rows={3}
              required
              value={license.licenseInput}
              onChange={(e) => license.setLicenseInput(e.target.value)}
              placeholder="请粘贴格式如 eyJsaWNlbnNl... 的完整 License Key 字符串"
              className="w-full border border-gray-200 dark:border-slate-700 rounded-xl p-3 text-xs font-mono bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00C776]/50"
            />
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/60 text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
            <p className="font-bold flex items-center gap-1.5">
              <span>🛡️</span> 离线非对称密码学验签保障
            </p>
            <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 leading-relaxed">
              Navelix 采用 Ed25519 纯离线公钥验签，验证过程无需联网、零数据上报，完全保障私有化数据隐私。
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={license.closeLicenseModal}
              className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={license.isActivatingLicense || !license.licenseInput.trim()}
              className="px-5 py-2 text-xs font-bold text-white bg-[#00C776] hover:bg-[#00B068] rounded-xl transition-all disabled:opacity-50 cursor-pointer shadow-md"
            >
              {license.isActivatingLicense ? "验签激活中…" : "立即激活 Pro"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
