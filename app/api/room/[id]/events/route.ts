// GET /api/room/:id/events?token= — SSE. 연결 시 스냅샷, 이후 ver가 바뀔 때마다 스냅샷, 15초마다 ping.
// 저장소를 500ms 간격으로 확인한다(인스턴스 간 공유가 없어 pub/sub 대신 폴링).
// 연결이 살아 있는 동안 내 lastSeen을 갱신 — 이것이 상대에게 보이는 "접속 중" 신호.
import { NextRequest } from "next/server";
import { RoomStatus, SSE_MAX_MS, SSE_POLL_DONE_MS, SSE_POLL_IDLE_MS, SSE_POLL_MS, SSE_TOUCH_MS } from "@/lib/room";
import { readRoom, seatOf, toView, touch } from "@/lib/roomServer";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const enc = new TextEncoder();
// 상태별 폴링 간격 — Redis 커맨드 수를 진행 중일 때만 촘촘히 쓴다
const pollFor = (s: RoomStatus) => (s === "playing" ? SSE_POLL_MS : s === "finished" || s === "abandoned" ? SSE_POLL_DONE_MS : SSE_POLL_IDLE_MS);
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = req.nextUrl.searchParams.get("token");
  const first = await readRoom(id, Date.now());
  if (!first) return Response.json({ error: "방이 없어요" }, { status: 404 });
  const seat = seatOf(first, token);
  if (!seat || !token) return Response.json({ error: "참가자가 아니에요" }, { status: 401 });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };
      const stop = () => {
        closed = true;
      };
      req.signal.addEventListener("abort", stop);

      const began = Date.now();
      let lastVer = -1;
      let lastTouch = 0;
      let lastPing = began;
      controller.enqueue(enc.encode("retry: 1000\n\n"));

      while (!closed && Date.now() - began < SSE_MAX_MS) {
        const now = Date.now();
        try {
          if (now - lastTouch >= SSE_TOUCH_MS) {
            lastTouch = now;
            await touch(id, token, now).catch(() => {});
          }
          const rec = await readRoom(id, now);
          if (!rec) {
            send("gone", { reason: "expired" });
            break;
          }
          if (rec.ver !== lastVer) {
            lastVer = rec.ver;
            send("state", toView(rec, seat, now));
          } else if (now - lastPing >= SSE_TOUCH_MS) {
            lastPing = now;
            send("ping", { now });
          }
          await sleep(pollFor(rec.status));
        } catch (e) {
          console.error("[sse]", e);
          await sleep(SSE_POLL_MS * 2);
        }
      }
      if (!closed) send("reconnect", { now: Date.now() });
      req.signal.removeEventListener("abort", stop);
      try {
        controller.close();
      } catch {}
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
