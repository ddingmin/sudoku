"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { DIFFICULTIES, DIFFICULTY_LABEL, Difficulty, dailyNumber } from "@/lib/sudoku";
import { formatTime } from "@/lib/encode";

interface HeaderProps {
  difficulty: Difficulty;
  daily: boolean;
  dateKey: string;
  elapsed: number;
  mistakes: number;
  onNewGame: (diff: Difficulty, daily: boolean) => void;
  onOpenStats: () => void;
}

function useTheme() {
  const toggle = () => {
    const isDark =
      (document.documentElement.dataset.theme ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")) === "dark";
    const next = isDark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("sudoku:theme", next);
    } catch {}
  };
  return { toggle };
}

export default function Header({ difficulty, daily, dateKey, elapsed, mistakes, onNewGame, onOpenStats }: HeaderProps) {
  const { toggle } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [menuOpen]);

  const iconBtn = "chunky-sm chunky-press flex h-10 w-10 items-center justify-center";

  return (
    <header className="w-full">
      {/* 워드마크 라인 */}
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2.5">
          <span className="swipe">
            <span className="font-display text-[1.9rem] leading-none">스도쿠</span>
          </span>
          <span
            className="sticker -rotate-6"
            style={{ background: "var(--primary)", color: "var(--on-primary)" }}
          >
            매일 한 판
          </span>
        </h1>
        <div className="flex items-center gap-2">
          <button onClick={onOpenStats} aria-label="기록 보기" className={iconBtn} style={{ color: "var(--ink)" }}>
            <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M4 20v-6" />
              <path d="M10 20V8" />
              <path d="M16 20v-9" />
              <path d="M22 20H2" />
            </svg>
          </button>
          <button onClick={toggle} aria-label="테마 전환" className={iconBtn} style={{ color: "var(--ink)" }}>
            <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
            </svg>
          </button>
        </div>
      </div>

      {/* 상태 라인 */}
      <div className="mt-3.5 flex items-center justify-between">
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            className="chunky-sm chunky-press flex items-center gap-1.5 rounded-full! py-2 pl-3.5 pr-2.5 text-[0.78rem] font-extrabold"
            style={{ color: "var(--ink)" }}
          >
            {daily ? `오늘의 스도쿠 #${dailyNumber(dateKey)}` : "자유 스도쿠"}
            <span style={{ color: "var(--primary)" }}>{DIFFICULTY_LABEL[difficulty]}</span>
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" strokeWidth="3" strokeLinecap="round">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.96, rotate: -1 }}
                animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, y: -6, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="chunky absolute left-0 top-full z-30 mt-2 w-60 overflow-hidden p-1.5"
                style={{ boxShadow: "var(--shadow-lg)" }}
              >
                {[true, false].map((isDaily) => (
                  <div key={String(isDaily)}>
                    <p className="px-2.5 pb-1 pt-2 text-[0.62rem] font-extrabold uppercase tracking-wider" style={{ color: "var(--ink-faint)" }}>
                      {isDaily ? `오늘의 스도쿠 · ${dateKey}` : "자유 스도쿠 · 무작위"}
                    </p>
                    {DIFFICULTIES.map((d) => {
                      const active = daily === isDaily && d === difficulty;
                      return (
                        <button
                          key={d}
                          onClick={() => {
                            onNewGame(d, isDaily);
                            setMenuOpen(false);
                          }}
                          className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-[0.85rem] font-bold transition-colors"
                          style={{
                            background: active ? "var(--pop)" : "transparent",
                            color: active ? "var(--on-pop)" : "var(--ink)",
                          }}
                        >
                          {DIFFICULTY_LABEL[d]}
                          {active && (
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20 6 9 17l-5-5" />
                            </svg>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[0.85rem] font-extrabold" aria-label={`실수 ${mistakes}회`}>
            <span style={{ color: mistakes > 0 ? "var(--danger)" : "var(--ink-faint)" }}>✕</span>
            <span className="tabular" style={{ color: "var(--ink)" }}>
              {mistakes}
            </span>
          </span>
          <span className="font-display tabular text-[1.4rem] leading-none" style={{ color: "var(--ink)" }}>
            {formatTime(elapsed)}
          </span>
        </div>
      </div>
    </header>
  );
}
