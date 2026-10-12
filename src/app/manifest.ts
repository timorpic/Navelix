import { getTranslations } from "next-intl/server";
import type { MetadataRoute } from "next";
import { DEFAULT_SITE_TITLE } from "@/lib/constants";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const tx = await getTranslations();
  return {
    name: DEFAULT_SITE_TITLE,
    short_name: "Navelix",
    description: tx("your_personal_digital_workspace_bookmarks_todos__2379da0c"),
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#F6F8FA",
    theme_color: "#00C776",
    icons: [
      { src: "/pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/logo.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
    shortcuts: [
      {
        name: tx("quick_add_bookmark_2038ac4c"),
        short_name: tx("save_bookmark_50bf91b0"),
        description: tx("save_a_url_to_navelix_26e750e6"),
        url: "/?action=quick-add-bookmark",
      },
      {
        name: tx("quick_add_todo_889425e9"),
        short_name: tx("add_todo_fc73f8c2"),
        description: tx("capture_a_task_on_the_go_b7783296"),
        url: "/?action=quick-add-todo",
      },
    ],
  };
}