import { NextResponse } from "next/server";
import { getLocale } from "next-intl/server";
import { translateText } from "./server-translations";
import sourceIndex from "../../messages/source-index.json";

/** Preserve legacy errors for API clients; add a stable code and a localized display message. */
export async function localizedJson(body: unknown, init?: ResponseInit) {
  if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
    const key = (sourceIndex as Record<string, string>)[body.error];
    return NextResponse.json({ ...body, code: "code" in body ? body.code : key ? key.toUpperCase() : "REQUEST_FAILED", message: translateText(await getLocale(), body.error) }, init);
  }
  return NextResponse.json(body, init);
}
