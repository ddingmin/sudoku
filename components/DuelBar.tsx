"use client";

// 실시간 대결 진행 스트립 — 한 줄. 보드 크기를 깎지 않도록 하단 푸터 자리에 들어간다
// 상단 3px 라인: 친구(ink-faint) 위에 나(primary)를 겹쳐 앞선/뒤처진 폭이 그대로 보인다
import { formatTime } from "@/lib/encode";
import { paceLine } from "@/lib/duelText";

interface DuelBarProps {
  mine: number; // 내 정답 칸 수
  rival: number; // 친구 정답 칸 수
  total: number; // 채워야 할 칸 수
  rivalTimeSec: number | null; // 친구가 완주했으면 그 시간
  rivalPresence: "online" | "stale" | "finished" | "left" | "absent";
}

export default function DuelBar({ mine, rival, total, rivalTimeSec, rivalPresence }: DuelBarProps) {
  const diff = mine - rival;
  const finished = rivalPresence === "finished";
  const tone = finished || diff < 0 ? "var(--danger)" : diff > 0 ? "var(--primary)" : "var(--ink-soft)";
  const pct = (n: number) => `${total ? Math.min(100, (n / total) * 100) : 0}%`;
  const right =
    finished && rivalTimeSec !== null ? (
      <>
        친구{" "}
        <span className="font-display tabular text-[0.9rem]" style={{ color: "var(--danger)" }}>
          {formatTime(rivalTimeSec)}
        </span>
      </>
    ) : rivalPresence === "stale" ? (
      <span style={{ color: "var(--danger)" }}>연결 끊김</span>
    ) : rivalPresence === "left" ? (
      <span style={{ color: "var(--danger)" }}>나갔어요</span>
    ) : (
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--primary)" }} aria-hidden />
        접속 중
      </span>
    );

  return (
    <section
      aria-label="대결 진행"
      className="chunky-sm relative flex w-full items-center gap-2.5 overflow-hidden px-3.5 py-1.5"
      style={{ boxShadow: "var(--shadow-sm)" }}
    >
      <span aria-hidden className="absolute inset-x-0 top-0 h-[3px]" style={{ background: "var(--surface-dim)" }}>
        <span className="absolute inset-y-0 left-0 transition-[width] duration-500 ease-out" style={{ width: pct(rival), background: "var(--ink-faint)" }} />
        <span className="absolute inset-y-0 left-0 transition-[width] duration-500 ease-out" style={{ width: pct(mine), background: "var(--primary)" }} />
      </span>

      <span className="tabular shrink-0 text-[0.72rem] font-extrabold" style={{ color: "var(--ink)" }}>
        나 {mine}
        <span style={{ color: "var(--ink-faint)" }}> · 친구 {rival}</span>
      </span>
      <span className="min-w-0 flex-1 truncate text-[0.72rem] font-extrabold" style={{ color: tone }}>
        {paceLine(mine, rival, finished)}
      </span>
      <span className="shrink-0 text-[0.66rem] font-bold" style={{ color: "var(--ink-soft)" }}>
        {right}
      </span>
    </section>
  );
}
