// GET /api/room/:id?token= — 스냅샷 한 번 (재접속 직후·폴링 폴백용)
import { NextRequest } from "next/server";
import { readRoom, seatOf, toView } from "@/lib/roomServer";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const now = Date.now();
  const rec = await readRoom(id, now);
  if (!rec) return Response.json({ error: "방이 없어요" }, { status: 404 });
  const seat = seatOf(rec, req.nextUrl.searchParams.get("token"));
  if (!seat) return Response.json({ error: "참가자가 아니에요" }, { status: 401 });
  return Response.json(toView(rec, seat, now), { headers: { "Cache-Control": "no-store" } });
}
