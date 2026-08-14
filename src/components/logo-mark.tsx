"use client";

import { useNavelixConfig } from "@/hooks/use-navelix-config";

interface LogoMarkProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "h-8 w-8 rounded-xl text-base",
  md: "h-9 w-9 rounded-xl text-lg",
  lg: "h-12 w-12 rounded-2xl text-xl",
};

export default function LogoMark({
  size = "md",
  className = "",
}: LogoMarkProps) {
  const { config } = useNavelixConfig();

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden bg-white border border-gray-200 dark:border-slate-700 shadow-xs hover:shadow-md transition-all ${sizeClasses[size]} ${className}`}
    >
      {config.logoImage ? (
        /* eslint-disable-next-line @next/next/no-img-element -- 上传的自定义 LOGO 图片 */
        <img
          src={config.logoImage}
          alt="LOGO"
          className="h-full w-full object-cover"
        />
      ) : (
        <svg
          viewBox="0 0 256 256"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="h-full w-full p-1"
        >
          {/* Mid-Century Modern Alvin Lustig Coffee Aesthetic */}
          <g transform="translate(28, 28)">
            {/* Floating Organic Steam Lines */}
            <path
              d="M 65 30 C 60 15, 75 5, 70 -5"
              stroke="#1E293B"
              strokeWidth="7"
              strokeLinecap="round"
            />
            <path
              d="M 100 35 C 95 18, 110 8, 105 -2"
              stroke="#00C776"
              strokeWidth="7"
              strokeLinecap="round"
            />
            <path
              d="M 135 30 C 130 15, 145 5, 140 -5"
              stroke="#D97706"
              strokeWidth="7"
              strokeLinecap="round"
            />

            {/* Flat Geometric Coffee Cup Silhouette */}
            <path
              d="M 45 60 H 155 L 142 145 C 140 158, 128 168, 114 168 H 86 C 72 168, 60 158, 58 145 Z"
              fill="#1E293B"
            />

            {/* Cup Handle Ring */}
            <path
              d="M 152 75 C 178 75, 178 130, 147 130"
              stroke="#1E293B"
              strokeWidth="12"
              strokeLinecap="round"
            />

            {/* Organic Coffee Bean Core Cutout */}
            <g transform="translate(100, 114)">
              <path
                d="M -18 -26 C -38 -15, -38 15, -18 26 C -5 32, 10 18, 0 0 C 10 -18, -5 -32, -18 -26 Z"
                fill="#00C776"
              />
              <path
                d="M 18 -26 C 38 -15, 38 15, 18 26 C 5 32, -10 18, 0 0 C -10 -18, 5 -32, 18 -26 Z"
                fill="#D97706"
              />
              <path
                d="M 0 -28 C -8 -10, 8 10, 0 28"
                stroke="#FFFFFF"
                strokeWidth="4"
                strokeLinecap="round"
              />
            </g>
          </g>
        </svg>
      )}
    </div>
  );
}
