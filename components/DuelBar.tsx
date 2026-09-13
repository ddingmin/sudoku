"use client";

// 고스트 대결 진행 스트립 — 한 줄. 보드 크기를 깎지 않도록 하단 푸터 자리에 들어간다
// 상단 3px 라인: 상대(ink-faint) 위에 나(primary)를 겹쳐 앞선/뒤처진 폭이 그대로 보인다
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
  const pct = (n: number) => `${total ? Math.min(100, (n / total) * 100) : 0}%`;

  return (
    <section
      aria-label="대결 진행"
      className="chunky-sm relative flex w-full items-center gap-2.5 overflow-hidden px-3.5 py-1.5"
      style={{ boxShadow: "var(--shadow-sm)" }}
    >
      <span aria-hidden className="absolute inset-x-0 top-0 h-[3px]" style={{ background: "var(--surface-dim)" }}>
        <span className="absolute inset-y-0 left-0 transition-[width] duration-500 ease-out" style={{ width: pct(ghost), background: "var(--ink-faint)" }} />
        <span className="absolute inset-y-0 left-0 transition-[width] duration-500 ease-out" style={{ width: pct(mine), background: "var(--primary)" }} />
      </span>

      <span className="tabular shrink-0 text-[0.72rem] font-extrabold" style={{ color: "var(--ink)" }}>
        나 {mine}
        <span style={{ color: "var(--ink-faint)" }}> · 친구 {ghost}</span>
      </span>
      <span className="min-w-0 flex-1 truncate text-[0.72rem] font-extrabold" style={{ color: tone }}>
        {paceLine(mine, ghost, elapsed, opponent.timeSec)}
      </span>
      <span className="shrink-0 text-[0.66rem] font-bold" style={{ color: "var(--ink-soft)" }}>
        목표{" "}
        <span className="font-display tabular text-[0.9rem]" style={{ color: over ? "var(--danger)" : "var(--ink)" }}>
          {formatTime(opponent.timeSec)}
        </span>
      </span>
    </section>
  );
}
