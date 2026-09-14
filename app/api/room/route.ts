// POST /api/room — 방 생성 { difficulty } → { id, token, view }
import { NextRequest } from "next/server";
import { createRoom, errorResponse, toView } from "@/lib/roomServer";
import { getStore } from "@/lib/store";
import { Difficulty } from "@/lib/sudoku";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // 방 생성은 IP당 분당 10회
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
    const n = await getStore().incr(`rl:create:${ip}:${Math.floor(Date.now() / 60_000)}`, 90);
    if (n > 10) return Response.json({ error: "잠시 후 다시 시도해 주세요" }, { status: 429 });

    const body = (await req.json().catch(() => ({}))) as { difficulty?: Difficulty };
    const now = Date.now();
    const { rec, token } = await createRoom(body.difficulty ?? "normal", now);
    return Response.json({ id: rec.id, token, view: toView(rec, "host", now) });
  } catch (e) {
    return errorResponse(e);
  }
}
