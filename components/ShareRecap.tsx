"use client";

// 공유 랜딩의 풀이 리플레이 — 시드로 퍼즐을 재생성해 타임랩스 재생
import { useMemo } from "react";
import { ShareRecord } from "@/lib/encode";
import { computeHighlights } from "@/lib/recap";
import { generatePuzzle } from "@/lib/sudoku";
import RecapBoard from "./RecapBoard";

export default function ShareRecap({ record }: { record: ShareRecord }) {
  const puzzle = useMemo(() => {
    if (record.seed === undefined) return null;
    try {
      return generatePuzzle(record.difficulty, record.seed).puzzle;
    } catch {
      return null;
    }
  }, [record.seed, record.difficulty]);

  if (!puzzle || !record.moves || record.moves.length === 0) return null;

  const h = computeHighlights(record.moves);

  return (
    <div
      className="flex w-full items-center gap-4 p-4"
      style={{
        background: "var(--surface)",
        border: "2px solid var(--edge)",
        borderRadius: "var(--r-lg)",
        boxShadow: "var(--shadow-md)",
      }}
    >
      <RecapBoard puzzle={puzzle} moves={record.moves} size={132} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="text-[0.66rem] font-extrabold tracking-widest" style={{ color: "var(--ink-faint)" }}>
          친구의 풀이 리플레이
        </p>
        {h.longestThink && (
          <p className="text-[0.74rem] font-bold leading-snug">
            <span style={{ color: "var(--ink-faint)" }}>최장 고민 </span>
            <span>{h.longestThink.sec}초</span>
          </p>
        )}
        {h.lastSpurt && (
          <p className="text-[0.74rem] font-bold leading-snug">
            <span style={{ color: "var(--ink-faint)" }}>라스트 스퍼트 </span>
            <span>
              {h.lastSpurt.cells}칸 {h.lastSpurt.sec}초
            </span>
          </p>
        )}
        <p className="text-[0.74rem] font-bold leading-snug">
          <span style={{ color: "var(--ink-faint)" }}>오답 칸 </span>
          <span style={{ color: h.errorCells > 0 ? "var(--danger)" : "var(--ink)" }}>
            {h.errorCells > 0 ? `${h.errorCells}곳` : "없음"}
          </span>
        </p>
      </div>
    </div>
  );
}
