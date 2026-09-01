"use client";

// 풀이 타임랩스 미니 보드 — 승리 모달·공유 랜딩 공용
import { useEffect, useMemo, useRef, useState } from "react";
import { Move } from "@/lib/encode";

interface RecapBoardProps {
  puzzle: number[]; // 81칸, 0 = 빈 칸 (주어진 숫자만 채워진 그리드)
  moves: Move[];
  size?: number; // px
  autoPlay?: boolean;
}

export default function RecapBoard({ puzzle, moves, size = 200, autoPlay = true }: RecapBoardProps) {
  const [step, setStep] = useState(autoPlay ? 0 : moves.length);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const play = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setStep(0);
    const perMove = Math.min(120, Math.max(28, 2400 / Math.max(1, moves.length)));
    timerRef.current = setInterval(() => {
      setStep((s) => {
        if (s >= moves.length) {
          if (timerRef.current) clearInterval(timerRef.current);
          return s;
        }
        return s + 1;
      });
    }, perMove);
  };

  useEffect(() => {
    const t = autoPlay ? setTimeout(play, 500) : null;
    return () => {
      // 자동 재생 여부와 무관하게 재생 중 인터벌을 항상 정리
      if (t) clearTimeout(t);
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // step까지의 무브를 반영한 셀 상태: 0 없음 | 1 정답 | 2 힌트 | 3 오답(아직 정정 전)
  const cells = useMemo(() => {
    const state = new Array<number>(81).fill(0);
    for (let m = 0; m < Math.min(step, moves.length); m++) {
      const { i, k } = moves[m];
      state[i] = k === 0 ? 1 : k === 2 ? 2 : 3;
    }
    return state;
  }, [step, moves]);

  const done = step >= moves.length;
  const cell = size / 9;

  return (
    <div className="relative" style={{ width: size }}>
      <div
        className="grid grid-cols-9 grid-rows-9 overflow-hidden"
        style={{
          width: size,
          height: size,
          background: "var(--surface)",
          border: "2px solid var(--edge)",
          borderRadius: 12,
          boxShadow: "var(--shadow-sm)",
        }}
        aria-label="풀이 리플레이"
      >
        {puzzle.map((given, i) => {
          const r = Math.floor(i / 9);
          const c = i % 9;
          const s = cells[i];
          const bg = s === 1 ? "var(--primary)" : s === 2 ? "var(--pop)" : s === 3 ? "var(--danger)" : "transparent";
          return (
            <span
              key={i}
              className="relative flex items-center justify-center"
              style={{
                borderRight: c === 8 ? "none" : c % 3 === 2 ? "1.5px solid var(--box-line)" : "1px solid var(--cell-line)",
                borderBottom: r === 8 ? "none" : r % 3 === 2 ? "1.5px solid var(--box-line)" : "1px solid var(--cell-line)",
              }}
            >
              {given > 0 ? (
                <span
                  className="rounded-full"
                  style={{ width: cell * 0.28, height: cell * 0.28, background: "var(--ink-faint)", opacity: 0.55 }}
                />
              ) : (
                s > 0 && (
                  <span
                    className="anim-pop rounded-[3px]"
                    style={{ width: cell * 0.62, height: cell * 0.62, background: bg }}
                  />
                )
              )}
            </span>
          );
        })}
      </div>
      {/* 다시 재생 */}
      {done && moves.length > 0 && (
        <button
          onClick={play}
          aria-label="리플레이 다시 재생"
          className="chunky-sm chunky-press absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center"
          style={{ color: "var(--ink)" }}
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-3-6.7" />
            <path d="M21 2v6h-6" />
          </svg>
        </button>
      )}
    </div>
  );
}
