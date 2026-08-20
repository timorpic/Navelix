"use client";

interface BrandLogoTextProps {
  text?: string;
  className?: string;
}

/**
 * 品牌 Logo 文本组件：
 * 精细化美化 "Navelix" 中字母 "i" 的圆点（Tittle）与末尾字母 "x"，
 * 将其渲染为充满活力与质感的翡翠绿主题色 (#00C776)，自带精致微发光光晕。
 */
export default function BrandLogoText({
  text,
  className = "",
}: BrandLogoTextProps) {
  const brandName = text?.trim() || "Navelix";

  // 默认或标准 Navelix 品牌名称
  if (brandName.toLowerCase() === "navelix") {
    const isCapital = brandName[0] === "N";
    return (
      <span className={`inline-flex items-baseline tracking-tight ${className}`}>
        <span>{isCapital ? "Navel" : "navel"}</span>
        {/* 字母 i：使用无点 ı (U+0131) 配合绝对定位的主题色翡翠圆点 */}
        <span className="relative inline-block">
          ı
          <span
            className="absolute top-[0.14em] left-1/2 -translate-x-1/2 w-[0.22em] h-[0.22em] rounded-full bg-[#00C776] shadow-[0_0_5px_rgba(0,199,118,0.6)]"
            aria-hidden="true"
          />
        </span>
        {/* 字母 x：使用主题色高亮 */}
        <span className="text-[#00C776] font-bold">x</span>
      </span>
    );
  }

  // 自定义名称若以 ix / Ix / IX 结尾，同样智能美化尾部的 i 点与 x
  if (/(.*)(i)(x)$/i.test(brandName)) {
    const match = brandName.match(/^(.*)(i)(x)$/i);
    if (match) {
      const [, prefix, , xChar] = match;
      return (
        <span className={`inline-flex items-baseline tracking-tight ${className}`}>
          <span>{prefix}</span>
          <span className="relative inline-block">
            ı
            <span
              className="absolute top-[0.14em] left-1/2 -translate-x-1/2 w-[0.22em] h-[0.22em] rounded-full bg-[#00C776] shadow-[0_0_5px_rgba(0,199,118,0.6)]"
              aria-hidden="true"
            />
          </span>
          <span className="text-[#00C776] font-bold">{xChar}</span>
        </span>
      );
    }
  }

  // 其他完全自定义的纯文本
  return <span className={className}>{brandName}</span>;
}
