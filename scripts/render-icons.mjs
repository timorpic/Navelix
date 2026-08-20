import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const rootDir = process.cwd();

const SVG_CONTENT = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
  <defs>
    <linearGradient id="g" x1="28" y1="228" x2="228" y2="28" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#00B368"/>
      <stop offset="55%" stop-color="#00C776"/>
      <stop offset="100%" stop-color="#39F2B0"/>
    </linearGradient>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="4" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <path d="M57 194 C43 194 35 182 39 167 L64 72 C68 57 80 48 94 48 C105 48 113 54 120 65 L151 117 L169 61 C173 47 185 39 198 42 C213 45 220 57 216 72 L191 180 C188 194 176 204 162 204 C150 204 142 198 135 187 L104 135 L86 190 C82 202 70 194 57 194 Z" fill="url(#g)"/>
  <ellipse cx="128" cy="128" rx="105" ry="45" transform="rotate(-24 128 128)" fill="none" stroke="url(#g)" stroke-width="10" opacity="0.95"/>
  <circle cx="218" cy="76" r="14" fill="#00C776" filter="url(#glow)"/>
  <circle cx="49" cy="184" r="13" fill="#00C776" filter="url(#glow)"/>
  <circle cx="166" cy="111" r="8" fill="#8CFFD5"/>
</svg>`;

// 1. 同步写入最新的 SVG 图标
fs.writeFileSync(path.join(rootDir, "extension", "icons", "icon.svg"), SVG_CONTENT, "utf8");
fs.writeFileSync(path.join(rootDir, "public", "logo.svg"), SVG_CONTENT, "utf8");

// 2. 准备渲染模板
const browserPath = fs.existsSync("C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe")
  ? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
  : "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

console.log(`Using browser: ${browserPath}`);

const tempHtmlPath = path.join(rootDir, "temp-icon.html");

function renderIcon(size, targetPath) {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: ${size}px;
      height: ${size}px;
      background: transparent;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    svg {
      width: ${size}px;
      height: ${size}px;
      display: block;
    }
  </style>
</head>
<body>
  ${SVG_CONTENT}
</body>
</html>`;
  fs.writeFileSync(tempHtmlPath, html, "utf8");

  execFileSync(browserPath, [
    "--headless",
    "--disable-gpu",
    "--hide-scrollbars",
    "--default-background-color=00000000",
    `--window-size=${size},${size}`,
    `--screenshot=${targetPath}`,
    tempHtmlPath,
  ]);
  console.log(`✓ Rendered ${size}x${size} -> ${path.relative(rootDir, targetPath)}`);
}

const targets = [
  { size: 16, path: path.join(rootDir, "extension", "icons", "icon-16.png") },
  { size: 32, path: path.join(rootDir, "extension", "icons", "icon-32.png") },
  { size: 48, path: path.join(rootDir, "extension", "icons", "icon-48.png") },
  { size: 128, path: path.join(rootDir, "extension", "icons", "icon-128.png") },
  { size: 16, path: path.join(rootDir, "public", "favicon", "favicon-16.png") },
  { size: 32, path: path.join(rootDir, "public", "favicon", "favicon-32.png") },
  { size: 48, path: path.join(rootDir, "public", "favicon", "favicon-48.png") },
  { size: 180, path: path.join(rootDir, "public", "favicon", "favicon-180.png") },
  { size: 192, path: path.join(rootDir, "public", "pwa", "icon-192.png") },
  { size: 512, path: path.join(rootDir, "public", "pwa", "icon-512.png") },
];

for (const t of targets) {
  renderIcon(t.size, t.path);
}

if (fs.existsSync(tempHtmlPath)) {
  fs.unlinkSync(tempHtmlPath);
}

console.log("All official icons rendered successfully!");
