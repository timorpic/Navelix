"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { localizeText } from "@/lib/localize-text";

/** For fixed labels returned by existing presentation helpers and API error messages. */
export function useText() {
  const translate = useTranslations();
  return useCallback((source: string) => localizeText(source, translate), [translate]);
}
