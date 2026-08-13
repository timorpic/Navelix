import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { safeFetch } from "@/lib/ssrf";

// GET /api/weather - 后端代理心知天气，隐藏 API Key 与位置
export async function GET() {
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
  if (!enabled) {
    return NextResponse.json({ enabled: false, message: "天气未启用" });
  }

  const key = row?.weather_api_key?.trim() || "SrnuFIBmt5hQtLK6Z";
  const loc = row?.weather_location?.trim() || "beijing";

  try {
    const url = `https://api.seniverse.com/v3/weather/now.json?key=${encodeURIComponent(key)}&location=${encodeURIComponent(loc)}&language=zh-Hans&unit=c`;
    const res = await safeFetch(url, { cache: "no-store", timeoutMs: 8000 });
    if (res.ok) {
      const data = await res.json();
      const n = data.results?.[0]?.now;
      const locInfo = data.results?.[0]?.location;
      if (n) {
        return NextResponse.json({
          temp: Math.round(Number(n.temperature)),
          windSpeed: Math.round(Number(n.wind_speed || 0)),
          desc: n.text || "晴",
          location: locInfo?.name || loc || "实时",
          updatedAt: data.results?.[0]?.last_update || "",
        });
      }
    }
  } catch (err) {
    console.warn("[Weather API] Fetch failed, falling back to default weather", err);
  }

  // 优雅降级兜底数据，避免前端弹出 502/报错
  return NextResponse.json({
    temp: 24,
    windSpeed: 12,
    desc: "晴",
    location: loc || "北京",
    updatedAt: "",
  });
}
