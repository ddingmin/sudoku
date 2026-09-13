// 대결 코드 라운드트립 + 시간 복원 오차 + 길이 검증. 실행: npx tsx scripts/verify-duel.ts
import { Move, ShareRecord } from "../lib/encode";
import { CP_STEP, decodeDuel, encodeDuel, ghostCells, countFilled, judge, restoreTimes, checkpoints } from "../lib/duel";
import { generateDaily, generatePuzzle } from "../lib/sudoku";

let seed = 11;
const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32);
let fails = 0;
const check = (cond: boolean, msg: string) => { if (!cond) { fails++; console.error("FAIL:", msg); } };

function fakeMoves(puzzle: number[]): { moves: Move[]; t: number } {
  const empties = puzzle.map((v, i) => (v === 0 ? i : -1)).filter((i) => i >= 0);
  const moves: Move[] = []; let t = 0;
  for (const i of empties) {
    t += 2 + Math.floor(rnd() * 25);
    if (rnd() < 0.12) { moves.push({ i, k: 1, t }); t += 3; }
    moves.push({ i, k: rnd() < 0.05 ? 2 : 0, t });
  }
  moves[7].t += 200; for (let n = 8; n < moves.length; n++) moves[n].t += 200; // 긴 고민 한 번
  return { moves, t: t + 200 };
}

for (const d of ["easy", "normal", "hard", "expert"] as const) {
  for (const daily of [true, false]) {
    const p = daily ? generateDaily(d, "2026-09-14") : generatePuzzle(d, Math.floor(rnd() * 2 ** 31));
    const { moves, t } = fakeMoves(p.puzzle);
    const rec: ShareRecord = { difficulty: d, timeSec: t, mistakes: 2, hints: 1, dateKey: "2026-09-14", streak: 3, daily, best: false, seed: p.seed, moves };

    // 도전장
    const code = encodeDuel({ record: rec });
    const out = decodeDuel(code);
    check(!!out && !out.opponent, `${d} challenge decode`); if (!out) continue;
    const r = out.record;
    check(r.difficulty === d && r.timeSec === t && r.mistakes === 2 && r.hints === 1 && r.daily === daily && r.seed === p.seed, `${d} header ${JSON.stringify(r)}`);
    check(JSON.stringify(r.moves!.map((m) => [m.i, m.k])) === JSON.stringify(moves.map((m) => [m.i, m.k])), `${d} moves order`);
    // 시간 복원: 체크포인트 인덱스에서 정확, 마지막 무브 = 총 시간, 단조 증가
    let maxErr = 0;
    r.moves!.forEach((m, n) => {
      const err = Math.abs(m.t - moves[n].t);
      maxErr = Math.max(maxErr, err);
      if (n % CP_STEP === CP_STEP - 1 && n < moves.length - 1) check(m.t === moves[n].t, `${d} checkpoint ${n} ${m.t} != ${moves[n].t}`);
      if (n > 0) check(m.t >= r.moves![n - 1].t, `${d} monotonic at ${n}`);
    });
    check(r.moves![r.moves!.length - 1].t === t, `${d} last t ${r.moves![r.moves!.length - 1].t} != ${t}`);
    check(Math.abs(r.moves![7].t - moves[7].t) <= 30, `${d} think anchor ${r.moves![7].t} vs ${moves[7].t}`);
    // 고스트 진행: 전부 지나면 정답 칸 = 빈 칸 수, 시작 전엔 0
    const empties = p.puzzle.filter((v) => v === 0).length;
    check(countFilled(ghostCells(r.moves!, t)) === empties, `${d} ghost full ${countFilled(ghostCells(r.moves!, t))} != ${empties}`);
    check(countFilled(ghostCells(r.moves!, 0)) === 0, `${d} ghost empty`);

    // 답장
    const reply = encodeDuel({ record: { ...rec, timeSec: t - 30 }, opponent: { timeSec: t, mistakes: 4, hints: 0 } });
    const ro = decodeDuel(reply);
    check(!!ro?.opponent && ro.opponent.timeSec === t && ro.opponent.mistakes === 4 && ro.opponent.hints === 0 && ro.record.timeSec === t - 30, `${d} reply`);
    check(judge(ro!.record.timeSec, ro!.opponent!.timeSec) === "win", `${d} judge`);

    console.log(`${d.padEnd(6)} ${daily ? "daily" : "free "} ${moves.length}수 → 도전장 ${code.length}자 · 답장 ${reply.length}자 · 복원 최대오차 ${maxErr}초`);
  }
}

// 무브 없는 기록도 코드로는 성립 (도전장으론 못 쓰지만 디코딩은 된다)
const plain = decodeDuel(encodeDuel({ record: { difficulty: "hard", timeSec: 900, mistakes: 0, hints: 0, dateKey: "2026-01-01", streak: 1, daily: true, best: false } }));
check(!!plain && plain.record.moves === undefined && plain.record.timeSec === 900, "plain record");

// 체크포인트 개수 상한(63)을 넘는 긴 로그도 마지막 앵커(총 시간)로 닫힌다
const long: Move[] = Array.from({ length: 400 }, (_, n) => ({ i: n % 81, k: 0 as const, t: n * 5 }));
check(checkpoints(long).length === 40, `cp count ${checkpoints(long).length}`);
const restored = restoreTimes(long, checkpoints(long), 1995, null);
check(restored[399].t === 1995 && restored[9].t === 45 && restored[0].t === 5, `long restore ${restored[0].t} ${restored[9].t} ${restored[399].t}`);

check(decodeDuel("3abc") === null, "v3 prefix rejected");
check(decodeDuel("4") === null, "empty payload null");
check(decodeDuel("garbage!!") === null, "garbage null");

console.log(fails === 0 ? "ALL OK" : `${fails} FAIL`);
process.exit(fails ? 1 : 0);
