import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Navelix · Personal Digital Hub",
    short_name: "Navelix",
    description: "你的个人数字工作空间：导航、待办、项目、AI 与模型额度一站式随身中枢。",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#F6F8FA",
    theme_color: "#00C776",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
      { src: "/logo.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
    shortcuts: [
      {
        name: "快速添加书签",
        short_name: "存书签",
        description: "快速收藏一条网址到 Navelix",
        url: "/?action=quick-add-bookmark",
      },
      {
        name: "快速记待办",
        short_name: "记待办",
        description: "随手记录一条待办任务",
        url: "/?action=quick-add-todo",
      },
    ],
  };
}