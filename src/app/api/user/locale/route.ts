import { localizedJson } from "@/lib/localized-json";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { saveUserConfigs } from "@/lib/user-data";
import { isLocale, LOCALE_COOKIE } from "@/lib/i18n";

/** Also supports anonymous viewers; the API proxy enforces CSRF for both. */
export async function POST(request: NextRequest) {
  let body: unknown;
  try { body = await request.json(); } catch { return localizedJson({ error: "Invalid JSON", code: "INVALID_JSON" }, { status: 400 }); }
  const language = body && typeof body === "object" && "language" in body ? body.language : undefined;
  if (!isLocale(language)) return localizedJson({ error: "Unsupported language", code: "INVALID_LOCALE" }, { status: 400 });
  const user = await getSessionUser();
  if (user) saveUserConfigs(user.id, { language });
  const response = NextResponse.json({ language });
  response.cookies.set(LOCALE_COOKIE, language, { path: "/", maxAge: 31536000, sameSite: "lax", httpOnly: true, secure: process.env.NAVELIX_COOKIE_SECURE === "true" });
  return response;
}
