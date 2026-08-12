import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/db";
import { clearSessionCookieOptions, destroySession } from "@/lib/auth";

export async function POST() {
  const cookieStore = await import("next/headers").then((m) => m.cookies());
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) await destroySession(token);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", clearSessionCookieOptions());
  return res;
}
