"use client";

import { useNavelixConfig } from "@/context/navelix-context";

export default function AdminProMenuCard() {
  const { config, updateConfig } = useNavelixConfig();
  const enabled = config.showProMenus !== false;
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
      <h3 className="text-sm font-bold text-gray-900 dark:text-white">Pro 菜单显示</h3>
      <div className="mt-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-gray-700 dark:text-slate-200">显示 Pro 功能菜单</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
            全站生效。关闭后隐藏系统设置中的品牌定制、自定义代码和链接探针菜单，一级「Pro 高级功能」入口始终保留。
          </p>
        </div>
        <button type="button" role="switch" aria-label="显示 Pro 功能菜单" aria-checked={enabled}
          onClick={() => updateConfig({ showProMenus: !enabled })}
          className={`relative h-6 w-11 shrink-0 rounded-full cursor-pointer transition-colors ${enabled ? "bg-[#00C776]" : "bg-gray-300 dark:bg-slate-600"}`}>
          <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${enabled ? "translate-x-5" : "translate-x-0"}`} />
        </button>
      </div>
    </section>
  );
}
