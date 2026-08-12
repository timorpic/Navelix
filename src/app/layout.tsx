import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Navelix · Personal Digital Hub",
  description: "Your personal digital operating system - navigation, tools, and projects in one workspace.",
};

// 主题初始化脚本：在浏览器解析 <body> 前绝对同步执行，消除白屏/浅色闪烁 (FOUC)
const themeInitScript = `(function(){try{var d=document.documentElement;var t=localStorage.getItem("navelix_theme");if(!t){var e=localStorage.getItem("navelix.user.config");if(e){try{var n=JSON.parse(e);if(n&&n.theme)t=n.theme;}catch(err){}}}var isDark=t==="dark"||((!t||t==="system")&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(isDark){d.classList.add("dark");}else{d.classList.remove("dark");}}catch(err){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get("navelix_theme_dark")?.value;
  const isDarkInitial = themeCookie === "1";

  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} h-full antialiased ${isDarkInitial ? "dark" : ""}`}
      suppressHydrationWarning
    >
      <head />
      <body className="min-h-full flex flex-col">
        <script
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
        {children}
      </body>
    </html>
  );
}
