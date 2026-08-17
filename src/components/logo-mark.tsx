"use client";

import { useNavelixConfig } from "@/hooks/use-navelix-config";
import BrandLogo from "./brand-logo";

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
        <BrandLogo />
      )}
    </div>
  );
}
