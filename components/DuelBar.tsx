"use client";

// 고스트 대결 진행 스트립 — 내 정답 칸 vs 상대 고스트 정답 칸, 상대 목표 시간
import { ShareRecord, formatTime } from "@/lib/encode";
import { paceLine } from "@/lib/duel";

interface DuelBarProps {
  opponent: ShareRecord;
  mine: number; // 내 정답 칸 수
  ghost: number; // 고스트 정답 칸 수
  total: number; // 채워야 할 칸 수
  elapsed: number;
}

export default function DuelBar({ opponent, mine, ghost, total, elapsed }: DuelBarProps) {
  const over = elapsed > opponent.timeSec;
  const diff = mine - ghost;
  const tone = over || diff < 0 ? "var(--danger)" : diff > 0 ? "var(--primary)" : "var(--ink-soft)";

  const bar = (label: string, n: number, color: string) => (
    <div className="flex items-center gap-2">
      <span className="w-7 shrink-0 text-[0.62rem] font-extrabold" style={{ color: "var(--ink-faint)" }}>
        {label}
      </span>
      <span className="relative h-2.5 flex-1 overflow-hidden rounded-full" style={{ background: "var(--surface-dim)", border: "1.5px solid var(--edge)" }}>
        <span
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${total ? Math.min(100, (n / total) * 100) : 0}%`, background: color }}
        />
      </span>
      <span className="tabular w-6 shrink-0 text-right text-[0.72rem] font-extrabold" style={{ color: "var(--ink)" }}>
        {n}
      </span>
    </div>
  );

  return (
    <section
      aria-label="고스트 대결 진행"
      className="chunky-sm flex w-full flex-col gap-1.5 px-3.5 py-2.5"
      style={{ boxShadow: "var(--shadow-sm)" }}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[0.62rem] font-extrabold tracking-widest" style={{ color: "var(--ink-faint)" }}>
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9 10h.01M15 10h.01" />
            <path d="M12 2a8 8 0 0 0-8 8v12l3-2 3 2 2-2 2 2 3-2 3 2V10a8 8 0 0 0-8-8Z" />
          </svg>
          고스트 대결
        </span>
        <span className="text-[0.66rem] font-bold" style={{ color: "var(--ink-soft)" }}>
          상대 기록 <span className="font-display tabular text-[0.85rem]" style={{ color: over ? "var(--danger)" : "var(--ink)" }}>{formatTime(opponent.timeSec)}</span>
        </span>
      </div>
      {bar("나", mine, "var(--primary)")}
      {bar("상대", ghost, "var(--ink-faint)")}
      <p className="text-[0.72rem] font-extrabold leading-tight" style={{ color: tone }}>
        {paceLine(mine, ghost, elapsed, opponent.timeSec)}
      </p>
    </section>
  );
}
