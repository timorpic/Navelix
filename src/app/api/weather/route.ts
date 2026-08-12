import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

// GET /api/weather - 后端代理心知天气，隐藏 API Key 与位置
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const row = db
    .prepare(
      "SELECT weather_enabled, weather_api_key, weather_location FROM user_configs WHERE user_id = ?",
    )
    .get(user.id) as
    | { weather_enabled: number; weather_api_key: string; weather_location: string }
    | undefined;

  const enabled = row?.weather_enabled === 1;
  const key = row?.weather_api_key?.trim() || "";
  const loc = row?.weather_location?.trim() || "";

  if (!enabled || !key || !loc) {
    return NextResponse.json({ error: "天气未配置" }, { status: 400 });
  }

  try {
    const url = `https://api.seniverse.com/v3/weather/now.json?key=${encodeURIComponent(key)}&location=${encodeURIComponent(loc)}&language=zh-Hans&unit=c`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json({ error: "心知天气请求失败" }, { status: res.status });
    }
    const data = await res.json();
    const n = data.results?.[0]?.now;
    const locInfo = data.results?.[0]?.location;
    if (!n) {
      return NextResponse.json({ error: "心知天气返回异常" }, { status: 502 });
    }
    return NextResponse.json({
      temp: Math.round(Number(n.temperature)),
      windSpeed: Math.round(Number(n.wind_speed || 0)),
      desc: n.text || "未知",
      location: locInfo?.name || "实时",
      updatedAt: data.results?.[0]?.last_update || "",
    });
  } catch {
    return NextResponse.json({ error: "天气服务不可用" }, { status: 502 });
  }
}
