import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AddLinkModal from "./add-link-modal";
import type { Category } from "@/types";

/**
 * 响应 PWA 快捷方式 / 外部链接的 `?action=quick-add-bookmark` 等快速采集。
 * 挂载在 HomeContent 中，根据 URL 参数自动弹出对应模态框。
 * 首次触发后自动清除 URL 中的 action 参数，避免刷新后重复弹窗。
 */
export function QuickCaptureLayer({
  categories,
  onAdd,
}: {
  categories: Category[];
  onAdd: (linkData: {
    title: string;
    url: string;
    description: string;
    category: string;
    icon: string;
  }) => void;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const action = searchParams.get("action");
  const [showBookmark, setShowBookmark] = useState(false);

  const cleanupAction = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (params.has("action")) {
      params.delete("action");
      const next = params.toString();
      router.replace(next ? `/?${next}` : "/", { scroll: false });
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (action === "quick-add-bookmark") {
      queueMicrotask(() => setShowBookmark(true));
    }
  }, [action]);

  return (
    <AddLinkModal
      open={showBookmark}
      categories={categories}
      onClose={() => {
        setShowBookmark(false);
        cleanupAction();
      }}
      onAdd={(data) => {
        setShowBookmark(false);
        cleanupAction();
        onAdd(data);
      }}
    />
  );
}