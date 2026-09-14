"use client";

// 실시간 대결 오버레이: 카운트다운 · 상단 배너 · 결과 없는 종료 모달(친구 이탈로 승리 등)
import { motion } from "framer-motion";
import { DIFF_THEME } from "@/lib/palette";
import { Difficulty } from "@/lib/sudoku";

// 3·2·1 — startAt(서버 시각)과 보정된 서버 시각으로 양쪽이 같은 순간에 시작한다
export function Countdown({ startAt, now, difficulty }: { startAt: number; now: number; difficulty: Difficulty }) {
  const left = Math.ceil((startAt - now) / 1000);
  const label = left > 0 ? String(Math.min(3, left)) : "시작!";
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-4"
      style={{ background: `color-mix(in srgb, ${DIFF_THEME[difficulty].primary} 92%, transparent)` }}
      aria-live="assertive"
    >
      <p className="text-[0.9rem] font-extrabold" style={{ color: "var(--on-flood)", opacity: 0.85 }}>
        {left > 3 ? "친구가 들어왔어요" : "같은 문제, 동시에 시작"}
      </p>
      <motion.p
        key={label}
        initial={{ scale: 0.6, opacity: 0, rotate: -6 }}
        animate={{ scale: 1, opacity: 1, rotate: -2 }}
        transition={{ type: "spring", stiffness: 380, damping: 18 }}
        className="font-display leading-none"
        style={{ color: "var(--on-flood)", fontSize: left > 0 ? "9rem" : "5rem", textShadow: "6px 6px 0 #141414" }}
      >
        {label}
      </motion.p>
    </motion.div>
  );
}

// 헤더 아래 얇은 안내 띠
export function RoomBanner({ tone, children, action }: { tone: "info" | "warn"; children: React.ReactNode; action?: { label: string; onClick: () => void } }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      role="status"
      className="chunky-sm flex w-full items-center justify-between gap-3 px-3.5 py-2 text-[0.76rem] font-extrabold"
      style={{ background: tone === "warn" ? "var(--danger-wash)" : "var(--surface)", color: tone === "warn" ? "var(--danger)" : "var(--ink)", boxShadow: "var(--shadow-sm)" }}
    >
      <span className="min-w-0 truncate">{children}</span>
      {action && (
        <button onClick={action.onClick} className="shrink-0 underline underline-offset-4" style={{ color: "var(--ink)" }}>
          {action.label}
        </button>
      )}
    </motion.div>
  );
}

// 내 기록 없이 끝난 대결(친구 이탈로 승리, 방 만료 등)
export function RoomEndModal({
  title,
  message,
  difficulty,
  primary,
  onExit,
}: {
  title: string;
  message: string;
  difficulty: Difficulty;
  primary?: { label: string; onClick: () => void; pending?: boolean };
  onExit: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      style={{ background: DIFF_THEME[difficulty].primary }}
    >
      <motion.div
        initial={{ y: 60, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 28, delay: 0.1 }}
        className="w-full max-w-md pb-[env(safe-area-inset-bottom)]"
        role="dialog"
        aria-label={title}
      >
        <p className="font-display mb-4 -rotate-2 text-center text-[2.6rem] leading-none" style={{ color: "var(--on-flood)", textShadow: "4px 4px 0 #141414" }}>
          {title}
        </p>
        <div className="p-5" style={{ background: "var(--surface)", border: "2.5px solid var(--edge)", borderRadius: "var(--r-xl)", boxShadow: "var(--shadow-xl)" }}>
          <p className="text-center text-[0.9rem] font-bold leading-snug" style={{ color: "var(--ink)" }}>
            {message}
          </p>
        </div>
        <div className="mt-4 flex flex-col gap-2.5">
          {primary && (
            <button
              onClick={primary.onClick}
              disabled={primary.pending}
              className="chunky chunky-press py-3.5 text-[0.95rem] font-extrabold disabled:opacity-60"
              style={{ background: "var(--pop)", color: "var(--on-pop)", boxShadow: "var(--shadow-md)" }}
            >
              {primary.label}
            </button>
          )}
          <button onClick={onExit} className="mt-1 text-[0.82rem] font-extrabold underline underline-offset-4" style={{ color: "var(--on-flood)" }}>
            홈으로
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
