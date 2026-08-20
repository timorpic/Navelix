# 🎨 Navelix 设计系统与配色方案规范 (Design System & Color Palette)

> **设计哲学**：极客冷调深色 × 灵动翡翠绿高亮。兼顾浅色模式的清新通透与暗黑模式的高级赛博质感，可直接无缝迁移复用到其他现代化 Web / App 项目。

---

## 📌 目录
- [1. 🌿 核心品牌色 (Brand Accent)](#1--核心品牌色-brand-accent)
- [2. ☀️ 浅色模式体系 (Light Mode)](#2--浅色模式体系-light-mode)
- [3. 🌙 暗黑模式体系 (Dark Mode)](#3--暗黑模式体系-dark-mode)
- [4. 🚥 语义化状态色 (Semantic Colors)](#4--语义化状态色-semantic-colors)
- [5. 📐 视觉与空间规范 (Geometry & Elevation)](#5--视觉与空间规范-geometry--elevation)
- [6. 💻 开箱即用配置代码 (CSS & Tailwind)](#6--开箱即用配置代码-css--tailwind)

---

## 1. 🌿 核心品牌色 (Brand Accent)

| 角色 Token | HEX 颜色值 | RGBA / Tailwind 映射 | 核心用途与场景 |
| :--- | :--- | :--- | :--- |
| **Primary (主品牌绿)** | `#00C776` | `bg-[#00C776]`, `text-[#00C776]` | 主按钮、选中态、进度条、品牌 Logo、关键链接 |
| **Primary Hover (悬浮深绿)** | `#00B368` | `hover:bg-[#00B368]` | 按钮 Hover、激活按压反馈（加深约 10%） |
| **Primary Glow (光晕/发光)** | `rgba(0,199,118,0.12)` | `bg-[#00C776]/10`, `shadow-[#00C776]/20` | 顶部背景光斑、选中卡片外发光、轻量背景 |
| **Primary Dark Bg (深底对比)**| `#0D4A2A` | `dark:bg-[#0D4A2A]` | 暗黑模式下的标签底色、进度底槽（防刺眼） |

---

## 2. ☀️ 浅色模式体系 (Light Mode)

> **基调**：冷白底色 + 纯白卡片，通透、轻量、高信息密度。

| 变量 Token | HEX 色值 | Tailwind 类名 | 应用场景 |
| :--- | :--- | :--- | :--- |
| `--background` | `#F6F8FA` | `bg-[#F6F8FA]` | 页面全局背景底色 |
| `--card-bg` | `#FFFFFF` | `bg-white` | 独立内容卡片、弹窗、下拉菜单 |
| `--card-border` | `#F1F5F9` / `#E5E7EB` | `border-gray-200/80` | 卡片边框、细分割线 |
| `--foreground` | `#111827` | `text-gray-900` | 主标题、重要数值、高反差点 |
| `--text-regular` | `#374151` | `text-gray-700` | 正文说明、表单 Label、列表项 |
| `--text-muted` | `#6B7280` | `text-gray-500` | 次要描述、副标题、时间戳 |
| `--text-subtle` | `#9CA3AF` | `text-gray-400` | 占位文字 (Placeholder)、禁用态 |
| `--hover-bg` | `#F3F4F6` | `hover:bg-gray-100` | 列表项、按钮 Hover 背景 |

---

## 3. 🌙 暗黑模式体系 (Dark Mode)

> **基调**：摒弃生硬纯黑，采用**高级深冷微紫灰（#151218）**作为基底，呈现极客质感。

| 变量 Token | HEX 色值 | Tailwind 类名 | 应用场景 |
| :--- | :--- | :--- | :--- |
| `--background` | `#151218` | `dark:bg-[#151218]` | 深色页面全局底色 |
| `--card-bg` | `#1C1920` | `dark:bg-[#1C1920]` (`slate-800`) | 独立内容容器、右侧边栏底色 |
| `--card-border` | `#2A2530` | `dark:border-[#2A2530]` (`slate-700`) | 深色容器描边、分割线 |
| `--card-hover` | `#24202B` | `dark:hover:bg-[#24202B]` | 交互卡片 Hover / Active 态 |
| `--input-bg` | `#151218` | `dark:bg-slate-900` | 输入框、搜索栏内嵌下沉底色 |
| `--foreground` | `#FFFFFF` | `dark:text-white` | 一级高光标题、核心数值 |
| `--text-muted` | `#6D6B75` | `dark:text-[#6D6B75]` (`slate-400/500`) | 正文、弱化说明、通用图标颜色 |

---

## 4. 🚥 语义化状态色 (Semantic Colors)

| 状态类型 | 核心主色 | 浅色组合 (Light Mode) | 深色组合 (Dark Mode) |
| :--- | :--- | :--- | :--- |
| **🟢 成功 / 正常** | `#00C776` / `#10B981` | `bg-emerald-50 text-emerald-700 border-emerald-200` | `dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800` |
| **🟡 预警 / 注意** | `#FF9F00` / `#F59E0B` | `bg-amber-50 text-amber-700 border-amber-200` | `dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800` |
| **🔴 危险 / 逾期** | `#FF3B30` / `#EF4444` | `bg-rose-50 text-rose-700 border-rose-200` | `dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800` |
| **🔵 信息 / 科技** | `#3B82F6` / `#06B6D4` | `bg-sky-50 text-sky-700 border-sky-200` | `dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800` |

---

## 5. 📐 视觉与空间规范 (Geometry & Elevation)

### 🔘 圆角矩阵 (Border Radius)
- **外层卡片 / 主工作台**：`rounded-2xl` (`16px`)
- **按钮 / 输入框 / 小卡片**：`rounded-xl` (`12px`)
- **胶囊标签 / 状态徽章**：`rounded-full`
- **大型模态弹窗 (Modal)**：`rounded-3xl` (`24px`)

### 🌫️ 毛玻璃与阴影 (Glassmorphism & Shadows)
- **浅色毛玻璃**：`bg-white/90 backdrop-blur-md border border-gray-200/80 shadow-2xs`
- **深色毛玻璃**：`bg-slate-900/80 backdrop-blur-md border border-slate-800 shadow-2xs`
- **背景光晕渲染**：`w-80 h-80 bg-[#00C776]/10 rounded-full blur-3xl pointer-events-none`

---

## 6. 💻 开箱即用配置代码 (CSS & Tailwind)

### 📄 `globals.css` 核心样式定义
```css
:root {
  --background: #f6f8fa;
  --foreground: #111827;
  --card-bg: #ffffff;
  --card-border: #f1f5f9;
  --text-muted: #6b7280;
  --brand-primary: #00c776;
}

html.dark,
body.dark {
  --background: #151218;
  --foreground: #6d6b75;
  --card-bg: #1c1920;
  --card-border: #2a2530;
  --text-muted: #6d6b75;
  --brand-primary: #00c776;
}

/* 覆盖深色下的 Slate 色阶，统一定制为微紫黑极客调 */
.dark {
  --color-slate-50: #6d6b75;
  --color-slate-100: #ffffff;
  --color-slate-200: #ffffff;
  --color-slate-300: #6d6b75;
  --color-slate-400: #6d6b75;
  --color-slate-500: #6d6b75;
  --color-slate-600: #2a2530;
  --color-slate-700: #2a2530;
  --color-slate-800: #1c1920;
  --color-slate-900: #151218;
}

body {
  background-color: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans, system-ui, -apple-system, sans-serif);
  min-height: 100vh;
}
```

### 🧩 常用 UI 组件 HTML 模板

#### 1. 经典卡片容器 (Card)
```html
<div class="rounded-2xl p-5 bg-white dark:bg-slate-800/90 border border-gray-200/80 dark:border-slate-700 shadow-2xs transition-colors">
  <div class="flex items-center justify-between mb-3">
    <div class="flex items-center gap-2">
      <span class="p-1.5 rounded-lg bg-[#00C776]/10 text-[#00C776]">🚀</span>
      <h3 class="text-sm font-bold text-gray-900 dark:text-white">系统核心模块</h3>
    </div>
    <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800">
      🟢 运行中
    </span>
  </div>
  <p class="text-xs text-gray-500 dark:text-[#6D6B75] leading-relaxed">
    这里是卡片正文说明内容，在深浅色模式下具备极佳的对比度与可读性。
  </p>
  <button class="mt-4 w-full py-2 px-4 rounded-xl font-bold text-xs text-white bg-[#00C776] hover:bg-[#00B368] active:scale-[0.98] transition-all shadow-xs cursor-pointer">
    立即操作
  </button>
</div>
```

#### 2. 发光 Banner 横幅 (Hero Banner)
```html
<div class="relative overflow-hidden rounded-2xl bg-white/90 dark:bg-slate-900/80 backdrop-blur-md p-6 border border-gray-200/80 dark:border-slate-800 shadow-2xs">
  <!-- 背景氛围光斑 -->
  <div class="absolute -right-16 -top-16 w-64 h-64 bg-[#00C776]/10 rounded-full blur-3xl pointer-events-none"></div>
  <div class="relative z-10">
    <h1 class="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
      早上好，开发者 👋
    </h1>
    <p class="text-xs text-gray-500 dark:text-[#6D6B75] mt-1">
      今天是数字化高效办公的一天
    </p>
  </div>
</div>
```
