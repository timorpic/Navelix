"use client";

import { useId } from "react";

interface BrandLogoProps {
  className?: string;
}

/**
 * Navelix 官方品牌 Symbol Logo SVG (N + Orbit + Nodes + Direction)
 * 独立纯组件，不依赖任何 Config/Provider，可在登录页、侧边栏、后台等多个位置复用，
 * 保证所有场景下 Logo 图形完全一致，采用 useId 消除多实例 SVG ID 冲突。
 */
export default function BrandLogo({ className = "h-full w-full" }: BrandLogoProps) {
  const rawId = useId();
  const id = rawId.replace(/[^a-zA-Z0-9_-]/g, "");
  const gradId = `nav-g-${id}`;
  const glowId = `nav-w-${id}`;

  return (
    <svg
      viewBox="0 0 256 256"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id={gradId} x1="28" y1="228" x2="228" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00B368" />
          <stop offset="55%" stopColor="#00C776" />
          <stop offset="100%" stopColor="#39F2B0" />
        </linearGradient>
        <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* N Lettermark */}
      <path
        d="M57 194 C43 194 35 182 39 167 L64 72 C68 57 80 48 94 48 C105 48 113 54 120 65 L151 117 L169 61 C173 47 185 39 198 42 C213 45 220 57 216 72 L191 180 C188 194 176 204 162 204 C150 204 142 198 135 187 L104 135 L86 190 C82 202 70 194 57 194 Z"
        fill={`url(#${gradId})`}
      />

      {/* Dynamic Orbit Ring */}
      <ellipse
        cx="128"
        cy="128"
        rx="105"
        ry="45"
        transform="rotate(-24 128 128)"
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth="10"
        opacity="0.95"
      />

      {/* Orbital Nodes */}
      <circle cx="218" cy="76" r="14" fill="#00C776" filter={`url(#${glowId})`} />
      <circle cx="49" cy="184" r="13" fill="#00C776" filter={`url(#${glowId})`} />
      <circle cx="166" cy="111" r="8" fill="#8CFFD5" />
    </svg>
  );
}