"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { DIFFICULTIES, DIFFICULTY_LABEL } from "@/lib/sudoku";
import { Stats, clearedDayCount, streakInfo } from "@/lib/stats";
import { backupUrl } from "@/lib/backup";
import GrassGrid from "./GrassGrid";
import { encodeRecord, formatTime, shareText, ShareRecord } from "@/lib/encode";
import { challengeText, encodeDuel, isChallengeable } from "@/lib/duel";

interface StatsPanelProps {
  stats: Stats;
  onOpenRecord: (record: ShareRecord) => void; // 최근 게임 행 → 게임 종료 화면과 같은 결과 모달
  onClose: () => void;
}

export default function StatsPanel({ stats, onOpenRecord, onClose }: StatsPanelProps) {
  const [toast, setToast] = useState<string | null>(null);
  const { current: streak, max: maxStreak } = streakInfo(stats.days);
  const dayCount = clearedDayCount(stats);
  const winRate = stats.played > 0 ? Math.round((stats.cleared / stats.played) * 100) : 0;

  // 공유 시트 → 클립보드 폴백
  const shareLink = async (title: string, text: string, url: string, copiedMsg: string) => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      showToast(copiedMsg);
    } catch {
      showToast("복사에 실패했어요");
    }
  };

  const shareHistory = (r: ShareRecord) => shareLink("스도쿠", shareText(r), `${location.origin}/share/${encodeRecord(r)}`, "링크를 복사했어요");

  // 지난 기록으로도 대결 신청 — 무브 로그(시간 포함)가 남아 있는 기록만
  const shareChallenge = (r: ShareRecord) =>
    shareLink("스도쿠 1:1 대결", challengeText(r), `${location.origin}/duel/${encodeDuel({ record: r })}`, "대결 링크를 복사했어요");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  // 기록 옮기기: 기록 전체를 담은 링크를 공유/복사. 다른 기기에서 열면 합쳐진다
  const exportBackup = async () => {
    const url = backupUrl(stats, location.origin);
    if (navigator.share) {
      try {
        await navigator.share({ title: "스도쿠 기록 옮기기", text: "이 링크를 새 기기에서 열면 기록이 합쳐집니다", url });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast("기록 링크를 복사했어요");
    } catch {
      showToast("복사에 실패했어요");
    }
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

        {/* 잔디 */}
        <div className="mt-6 flex items-end justify-between">
          <h3 className="text-[0.68rem] font-extrabold uppercase tracking-wider" style={{ color: "var(--ink-faint)" }}>
            매일의 기록
          </h3>
          <p className="tabular text-[0.66rem] font-bold" style={{ color: "var(--ink-soft)" }}>
            {dayCount > 0 ? `${dayCount}일 클리어 · 최장 ${maxStreak}일 연속` : "아직 기록 없음"}
          </p>
        </div>
        <div className="chunky-sm mt-2 p-3" style={{ boxShadow: "var(--shadow-sm)" }}>
          <GrassGrid days={stats.days} />
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
            아직 클리어 기록이 없어요
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
                seed: h.seed,
                moves: h.moves,
              };
              return (
                <li key={i} className="chunky-sm flex items-center justify-between gap-2 pr-4" style={{ boxShadow: "var(--shadow-sm)" }}>
                  {/* 행 클릭 → 게임 종료 화면과 동일한 결과 모달 (리캡·공유·대결 신청) */}
                  <button type="button" onClick={() => onOpenRecord(record)} className="min-w-0 flex-1 py-3 pl-4 text-left">
                    <p className="text-[0.8rem] font-extrabold">
                      {DIFFICULTY_LABEL[h.difficulty]}
                      {record.best && (
                        <span className="sticker ml-2 rotate-3" style={{ background: "var(--danger)", color: "#ffffff", fontSize: "0.55rem", padding: "3px 6px" }}>
                          BEST
                        </span>
                      )}
                      <span className="ml-1.5 inline-block whitespace-nowrap text-[0.66rem] font-bold" style={{ color: "var(--ink-faint)" }}>
                        {h.daily ? "오늘의 스도쿠" : "자유"} · {h.dateKey.replace(/-/g, ".")}
                      </span>
                    </p>
                    <p className="tabular mt-1.5 flex items-center gap-3 text-[0.72rem] font-bold" style={{ color: "var(--ink-soft)" }}>
                      <span className="flex items-center gap-1" aria-label={`클리어 타임 ${formatTime(h.timeSec)}`}>
                        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <path d="M12 6v6l4 2" />
                        </svg>
                        {formatTime(h.timeSec)}
                      </span>
                      <span className="flex items-center gap-1" aria-label={`실수 ${h.mistakes}회`}>
                        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke={h.mistakes > 0 ? "var(--danger)" : "currentColor"} strokeWidth="3" strokeLinecap="round">
                          <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                        {h.mistakes}
                      </span>
                      <span className="flex items-center gap-1" aria-label={`힌트 ${h.hints}회`}>
                        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
                          <path d="M9 18h6" />
                          <path d="M10 22h4" />
                        </svg>
                        {h.hints}
                      </span>
                    </p>
                  </button>
                  {isChallengeable(record) && (
                    <button
                      onClick={() => shareChallenge(record)}
                      aria-label="이 기록으로 대결 신청"
                      className="chunky-sm chunky-press flex h-9 w-9 shrink-0 items-center justify-center"
                      style={{ background: "var(--pop)", color: "var(--on-pop)" }}
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m14.5 17.5 3-3" />
                        <path d="M3 21l6-6" />
                        <path d="m14 5 5 5" />
                        <path d="M21 3l-8.5 8.5" />
                        <path d="m9.5 6.5-3-3" />
                        <path d="M10 14l-6 6" />
                        <path d="M3 3l8.5 8.5" />
                      </svg>
                    </button>
                  )}
                  <button
                    onClick={() => shareHistory(record)}
                    aria-label="이 기록 공유"
                    className="chunky-sm chunky-press flex h-9 w-9 shrink-0 items-center justify-center"
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

        {/* 기록 옮기기 */}
        <div className="mt-6 flex items-center justify-between gap-3 p-4" style={{ background: "var(--surface)", border: "2px dashed var(--ink-faint)", borderRadius: "var(--r-md)" }}>
          <div className="min-w-0">
            <p className="text-[0.78rem] font-extrabold">다른 기기로 기록 옮기기</p>
            <p className="mt-0.5 text-[0.66rem] font-bold leading-snug" style={{ color: "var(--ink-faint)" }}>
              새 기기에서 열면 기록이 합쳐집니다
            </p>
          </div>
          <button
            onClick={exportBackup}
            className="chunky-sm chunky-press shrink-0 px-3.5 py-2.5 text-[0.76rem] font-extrabold"
            style={{ background: "var(--pop)", color: "var(--on-pop)" }}
          >
            링크 만들기
          </button>
        </div>

        {toast && (
          <p className="mt-3 rounded-full px-4 py-2 text-center text-[0.78rem] font-extrabold" style={{ background: "var(--ink)", color: "var(--ground)" }}>
            {toast}
          </p>
        )}
      </motion.div>
    </motion.div>
  );
}
