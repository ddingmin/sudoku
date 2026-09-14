// 실시간 대결 서버 로직 검증. 1부: 인메모리 저장소로 서버 함수를 직접 호출(시각 주입 → 만료·기권 검증)
// 2부: 개발 서버(localhost:3000)가 떠 있으면 HTTP + SSE 라운드트립. 실행: npx tsx scripts/verify-room.ts
import { createRoom, joinRoom, leaveRoom, readRoom, rematch, reportProgress, toView, touch, RoomError } from "../lib/roomServer";
import { COUNTDOWN_MS, FORFEIT_MS, WAITING_TTL_MS, decodeResult, encodeResult, outcomeFor, playerTimeSec, resultFromView } from "../lib/room";

let fails = 0;
const check = (cond: boolean, msg: string) => { if (!cond) { fails++; console.error("FAIL:", msg); } };
const expectErr = async (p: Promise<unknown>, status: number, msg: string) => {
  try { await p; check(false, `${msg}: 에러가 나야 함`); } catch (e) { check(e instanceof RoomError && e.status === status, `${msg}: ${e instanceof RoomError ? e.status : e}`); }
};

async function unit() {
  let now = 1_000_000;
  const { rec: r0, token: hostTok } = await createRoom("easy", now);
  check(r0.status === "waiting" && r0.puzzle.length === 81 && r0.solution.every((v) => v >= 1 && v <= 9), "create");
  await expectErr(reportProgress(r0.id, hostTok, r0.puzzle, 0, now), 409, "대기 중 progress");

  // 참가 → 카운트다운 → 시작
  const { rec: r1, token: guestTok } = await joinRoom(r0.id, now);
  check(r1.status === "countdown" && r1.startAt === now + COUNTDOWN_MS && !!r1.guest, "join → countdown");
  await expectErr(joinRoom(r0.id, now), 409, "세 번째 참가");
  await expectErr(reportProgress(r0.id, hostTok, r0.puzzle, 0, now), 425, "카운트다운 중 progress");
  now += COUNTDOWN_MS + 10;
  const r2 = (await readRoom(r0.id, now))!;
  check(r2.status === "playing", "startAt 지나면 playing");

  // 진행: 오답은 서버가 버림, 정답만 카운트
  const half = [...r0.puzzle];
  const empties = r0.puzzle.map((v, i) => (v === 0 ? i : -1)).filter((i) => i >= 0);
  empties.slice(0, 10).forEach((i) => (half[i] = r0.solution[i]));
  half[empties[10]] = (r0.solution[empties[10]] % 9) + 1; // 오답 하나
  const { rec: r3 } = await reportProgress(r0.id, hostTok, half, 1, now + 5000);
  check(r3.host.cells.length === 10 && r3.host.mistakes === 1 && !r3.host.finishedAt, `progress 10칸 (${r3.host.cells.length})`);
  await expectErr(reportProgress(r0.id, "bad-token", half, 0, now), 401, "잘못된 토큰");
  await expectErr(reportProgress(r0.id, hostTok, [1, 2, 3], 0, now), 400, "잘못된 값");

  // 게스트 완주 → winner=guest, 상태는 아직 playing (호스트가 남음). 60초 넘게 신호가 없으면 기권이므로 그 안에서
  const { rec: r4 } = await reportProgress(r0.id, guestTok, r0.solution, 0, now + 30_000);
  check(r4.winner === "guest" && r4.status === "playing" && r4.guest!.finishedAt === now + 30_000, "게스트 완주 → 승자, 진행 유지");
  const gv = toView(r4, "guest", now + 30_000);
  check(playerTimeSec(gv, "guest") === 30 && outcomeFor(gv, "guest") === "win" && outcomeFor(gv, "host") === "lose", "시간·승패 파생");
  // 호스트도 완주 → finished
  const { rec: r5 } = await reportProgress(r0.id, hostTok, r0.solution, 1, now + 45_000);
  check(r5.status === "finished" && r5.endedReason === "finished" && r5.winner === "guest", "둘 다 완주 → finished");
  const res = resultFromView(toView(r5, "host", now + 45_000))!;
  check(res.winner === "guest" && res.host.timeSec === 45 && res.guest.timeSec === 30, "결과 코드 파생");
  const code = encodeResult(res);
  const dec = decodeResult(code)!;
  check(JSON.stringify(dec) === JSON.stringify(res), `결과 코드 라운드트립 ${code.length}자`);
  console.log(`결과 코드 ${code.length}자: ${code}`);

  // 재대결: 둘이 동시에 눌러도 같은 방
  const a = await rematch(r0.id, hostTok, now + 100_000);
  const b = await rematch(r0.id, guestTok, now + 100_000);
  check(a.rematchId === b.rematchId && !!a.token && !b.token, "재대결 수렴");

  // 기권: 진행 중 leave
  const { rec: q0, token: qh } = await createRoom("normal", now);
  const { token: qg } = await joinRoom(q0.id, now);
  now += COUNTDOWN_MS + 1;
  const q1 = await leaveRoom(q0.id, qg, now);
  check(q1.status === "finished" && q1.endedReason === "forfeit" && q1.winner === "host" && q1.guest!.forfeit === true, "기권 → 상대 승");
  check(outcomeFor(toView(q1, "host", now), "host") === "win", "기권 승패 파생");
  void qh;

  // 연결 끊김: lastSeen이 FORFEIT_MS 넘으면 기권 처리
  const { rec: s0, token: sh } = await createRoom("normal", now);
  const { token: sg } = await joinRoom(s0.id, now);
  now += COUNTDOWN_MS + 1;
  await touch(s0.id, sh, now + 20_000); // 호스트만 살아 있음 (SSE 루프의 주기적 touch)
  await touch(s0.id, sh, now + 40_000);
  const s1 = (await readRoom(s0.id, now + FORFEIT_MS + 5000))!;
  check(s1.status === "finished" && s1.winner === "host" && s1.guest!.forfeit === true, "끊김 60초 → 기권");
  void sg;

  // 둘 다 끊기면 아무도 기권시키지 않고, 3배 지나면 폐기
  const { rec: b0, token: bh } = await createRoom("normal", now);
  const { token: bg } = await joinRoom(b0.id, now);
  now += COUNTDOWN_MS + 1;
  const b1 = (await readRoom(b0.id, now + FORFEIT_MS + 5000))!;
  check(b1.status === "playing" && !b1.host.forfeit && !b1.guest!.forfeit, "둘 다 끊김 → 기권 없음");
  const b2 = (await readRoom(b0.id, now + FORFEIT_MS * 3 + 5000))!;
  check(b2.status === "abandoned", "둘 다 오래 끊김 → 폐기");
  void bh; void bg;

  // 미참가 만료
  const { rec: e0 } = await createRoom("hard", now);
  const e1 = (await readRoom(e0.id, now + WAITING_TTL_MS + 1))!;
  check(e1.status === "abandoned" && e1.endedReason === "expired", "30분 미참가 → 만료");
  await expectErr(joinRoom(e0.id, now + WAITING_TTL_MS + 2), 410, "만료 방 참가");

  // 대기 중 호스트가 나가면 방 폐기
  const { rec: w0, token: wh } = await createRoom("hard", now);
  const w1 = await leaveRoom(w0.id, wh, now);
  check(w1.status === "abandoned", "대기 중 나가기 → 폐기");
}

async function http() {
  const BASE = "http://localhost:3000";
  const up = await fetch(BASE, { signal: AbortSignal.timeout(2000) }).then((r) => r.ok).catch(() => false);
  if (!up) { console.log("(dev 서버 없음 — HTTP 검증 생략)"); return; }
  const c = await fetch(`${BASE}/api/room`, { method: "POST", body: JSON.stringify({ difficulty: "easy" }) }).then((r) => r.json());
  check(!!c.id && !!c.token, "HTTP create");
  const j = await fetch(`${BASE}/api/room/${c.id}/join`, { method: "POST" }).then((r) => r.json());
  check(!!j.token && j.view.status === "countdown", "HTTP join");

  // SSE: 첫 이벤트가 state 스냅샷
  const ac = new AbortController();
  const res = await fetch(`${BASE}/api/room/${c.id}/events?token=${c.token}`, { signal: ac.signal });
  check(res.headers.get("content-type")?.startsWith("text/event-stream") ?? false, "SSE content-type");
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  const deadline = Date.now() + 8000;
  const events: Array<{ event: string; data: { status?: string; startAt?: number } }> = [];
  while (Date.now() < deadline && events.length < 2) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, idx); buf = buf.slice(idx + 2);
      const ev = /event: (\w+)/.exec(chunk)?.[1]; const data = /data: (.*)/.exec(chunk)?.[1];
      if (ev && data) events.push({ event: ev, data: JSON.parse(data) });
    }
  }
  ac.abort();
  check(events[0]?.event === "state" && events[0].data.status === "countdown", `SSE 첫 스냅샷 ${JSON.stringify(events[0]?.data?.status)}`);
  check(events[1]?.event === "state" && events[1].data.status === "playing", `SSE 시작 전이 수신 ${JSON.stringify(events[1]?.data?.status)}`);

  const bad = await fetch(`${BASE}/api/room/${c.id}/progress`, { method: "POST", headers: { authorization: `Bearer ${c.token}` }, body: JSON.stringify({ values: [1] }) });
  check(bad.status === 400, `HTTP 잘못된 progress ${bad.status}`);
  const unauth = await fetch(`${BASE}/api/room/${c.id}/events?token=nope`);
  check(unauth.status === 401, `SSE 토큰 검사 ${unauth.status}`);
  const nf = await fetch(`${BASE}/api/room/ZZZZZZ`);
  check(nf.status === 404 || nf.status === 401, `없는 방 ${nf.status}`);
  console.log("HTTP/SSE OK");
}

(async () => {
  await unit();
  await http();
  console.log(fails === 0 ? "ALL OK" : `${fails} FAIL`);
  process.exit(fails ? 1 : 0);
})();
