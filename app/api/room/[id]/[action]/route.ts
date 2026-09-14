// POST /api/room/:id/(join|progress|leave|rematch)
import { NextRequest } from "next/server";
import { RoomError, errorResponse, joinRoom, leaveRoom, rematch, reportProgress, seatOf, toView } from "@/lib/roomServer";

export const dynamic = "force-dynamic";

function bearer(req: NextRequest): string | null {
  const h = req.headers.get("authorization");
  return h?.startsWith("Bearer ") ? h.slice(7) : null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; action: string }> }) {
  const { id, action } = await params;
  const now = Date.now();
  try {
    switch (action) {
      case "join": {
        const { rec, token } = await joinRoom(id, now);
        return Response.json({ token, view: toView(rec, "guest", now) });
      }
      case "progress": {
        const body = (await req.json().catch(() => ({}))) as { values?: unknown; mistakes?: unknown };
        const { rec, seat } = await reportProgress(id, bearer(req), body.values, body.mistakes, now);
        return Response.json(toView(rec, seat, now));
      }
      case "leave": {
        const tok = bearer(req);
        const rec = await leaveRoom(id, tok, now);
        return Response.json(toView(rec, seatOf(rec, tok)!, now));
      }
      case "rematch": {
        const out = await rematch(id, bearer(req), now);
        return Response.json(out);
      }
      default:
        throw new RoomError(404, "없는 동작이에요");
    }
  } catch (e) {
    return errorResponse(e);
  }
}
