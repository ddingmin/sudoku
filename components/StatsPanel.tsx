"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { DIFFICULTIES, DIFFICULTY_LABEL } from "@/lib/sudoku";
import { Stats, currentStreak } from "@/lib/stats";
import { encodeRecord, formatTime, shareText, ShareRecord } from "@/lib/encode";

interface StatsPanelProps {
  stats: Stats;
  onClose: () => void;
}

export default function StatsPanel({ stats, onClose }: StatsPanelProps) {
  const [toast, setToast] = useState<string | null>(null);
  const streak = currentStreak(stats);
  const winRate = stats.played > 0 ? Math.round((stats.cleared / stats.played) * 100) : 0;

  const shareHistory = async (r: ShareRecord) => {
    const url = `${location.origin}/share/${encodeRecord(r)}`;
    const text = shareText(r);
    if (navigator.share) {
      try {
        await navigator.share({ title: "스도쿠", text, url });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setToast("링크를 복사했어요");
      setTimeout(() => setToast(null), 2000);
    } catch {}
  };

  const tile = (label: string, value: string, color?: string) => (
    <div key={label} className="chunky-sm flex flex-col items-center gap-1 p-3" style={{ boxShadow: "var(--shadow-sm)" }}>
      <p className="text-[0.62rem] font-extrabold" style={{ color: "var(--ink-faint)" }}>
        {label}
      </p>
      <p className="font-display tabular text-lg leading-none" style={{ color: color ?? "var(--ink)" }}>
        {value}
      </p>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      style={{ background: "color-mix(in srgb, var(--ink) 45%, transparent)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        className="max-h-[85dvh] w-full max-w-md overflow-y-auto p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        style={{
          background: "var(--ground)",
          border: "2.5px solid var(--edge)",
          borderRadius: "var(--r-xl)",
          boxShadow: "var(--shadow-xl)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="swipe">
            <span className="font-display text-2xl">나의 기록</span>
          </h2>
          <button onClick={onClose} aria-label="닫기" className="chunky-sm chunky-press flex h-9 w-9 items-center justify-center" style={{ color: "var(--ink)" }}>
            <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 요약 */}
        <div className="mt-5 grid grid-cols-4 gap-2">
          {tile("플레이", `${stats.played}`)}
          {tile("클리어", `${stats.cleared}`)}
          {tile("완주율", `${winRate}%`)}
          {tile("연속", streak > 0 ? `${streak}일` : "—", streak > 0 ? "var(--danger)" : undefined)}
        </div>

        {/* 난이도별 베스트 */}
        <h3 className="mt-6 text-[0.68rem] font-extrabold uppercase tracking-wider" style={{ color: "var(--ink-faint)" }}>
          난이도별 베스트
        </h3>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {DIFFICULTIES.map((d) =>
            tile(
              DIFFICULTY_LABEL[d],
              stats.bests[d] !== undefined ? formatTime(stats.bests[d]!) : "—",
              stats.bests[d] !== undefined ? "var(--primary)" : "var(--ink-faint)",
            ),
          )}
        </div>

        {/* 최근 게임 */}
        <h3 className="mt-6 text-[0.68rem] font-extrabold uppercase tracking-wider" style={{ color: "var(--ink-faint)" }}>
          최근 게임
        </h3>
        {stats.history.length === 0 ? (
          <p
            className="mt-3 p-6 text-center text-[0.8rem] font-bold"
            style={{ background: "var(--surface)", border: "2px dashed var(--cell-line)", borderRadius: "var(--r-md)", color: "var(--ink-faint)" }}
          >
            아직 클리어한 퍼즐이 없어요.
            <br />첫 판 깨면 여기부터 채워집니다.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {stats.history.map((h, i) => {
              const record: ShareRecord = {
                difficulty: h.difficulty,
                timeSec: h.timeSec,
                mistakes: h.mistakes,
                hints: h.hints,
                dateKey: h.dateKey,
                streak: 0,
                daily: h.daily,
                best: stats.bests[h.difficulty] === h.timeSec,
              };
              return (
                <li key={i} className="chunky-sm flex items-center justify-between px-4 py-3" style={{ boxShadow: "var(--shadow-sm)" }}>
                  <div>
                    <p className="text-[0.8rem] font-extrabold">
                      {DIFFICULTY_LABEL[h.difficulty]}
                      {record.best && (
                        <span className="sticker ml-2 rotate-3" style={{ background: "var(--danger)", color: "#ffffff", fontSize: "0.55rem", padding: "3px 6px" }}>
                          BEST
                        </span>
                      )}
                      <span className="ml-1.5 text-[0.66rem] font-bold" style={{ color: "var(--ink-faint)" }}>
                        {h.daily ? "오늘의 퍼즐" : "자유"} · {h.dateKey.replace(/-/g, ".")}
                      </span>
                    </p>
                    <p className="tabular mt-1 text-[0.72rem] font-bold" style={{ color: "var(--ink-soft)" }}>
                      ⏱ {formatTime(h.timeSec)} · ✕ {h.mistakes} · 💡 {h.hints}
                    </p>
                  </div>
                  <button
                    onClick={() => shareHistory(record)}
                    aria-label="이 기록 공유"
                    className="chunky-sm chunky-press flex h-9 w-9 items-center justify-center"
                    style={{ background: "var(--primary)", color: "var(--on-primary)" }}
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                      <path d="m16 6-4-4-4 4" />
                      <path d="M12 2v13" />
                    </svg>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {toast && (
          <p className="mt-3 rounded-full px-4 py-2 text-center text-[0.78rem] font-extrabold" style={{ background: "var(--ink)", color: "var(--ground)" }}>
            {toast}
          </p>
        )}
      </motion.div>
    </motion.div>
  );
}
