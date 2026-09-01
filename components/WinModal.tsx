"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { ShareRecord, encodeRecord, shareText } from "@/lib/encode";
import { downloadShareImage, shareImageFile } from "@/lib/shareImage";
import { computeHighlights, cellName } from "@/lib/recap";
import ShareCard from "./ShareCard";
import RecapBoard from "./RecapBoard";

interface WinModalProps {
  record: ShareRecord;
  puzzle?: number[] | null; // 주어진 숫자 그리드 (리캡 리플레이용)
  onNewGame: () => void;
  onClose: () => void;
}

function fireConfetti() {
  const colors = ["#2b4cff", "#c8f04d", "#e93a5e", "#ffffff"];
  confetti({ particleCount: 90, spread: 75, origin: { y: 0.7 }, colors, disableForReducedMotion: true });
  setTimeout(
    () => confetti({ particleCount: 50, angle: 60, spread: 60, origin: { x: 0, y: 0.8 }, colors, disableForReducedMotion: true }),
    250,
  );
  setTimeout(
    () => confetti({ particleCount: 50, angle: 120, spread: 60, origin: { x: 1, y: 0.8 }, colors, disableForReducedMotion: true }),
    400,
  );
}

export default function WinModal({ record, puzzle, onNewGame, onClose }: WinModalProps) {
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(fireConfetti, 350);
    return () => clearTimeout(t);
  }, []);

  const shareUrl = () => `${location.origin}/share/${encodeRecord(record)}`;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const copyToClipboard = async (text: string, msg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(msg);
    } catch {
      showToast("복사에 실패했어요");
    }
  };

  // 메인 공유: 이미지 파일 공유 시트 → 링크 공유 시트 → 클립보드
  const shareStory = async () => {
    setBusy(true);
    try {
      if (await shareImageFile(record, shareText(record, shareUrl()))) return;
      const url = shareUrl();
      const text = shareText(record);
      if (navigator.share) {
        try {
          await navigator.share({ title: "스도쿠", text, url });
          return;
        } catch (e) {
          if (e instanceof DOMException && e.name === "AbortError") return;
        }
      }
      await copyToClipboard(`${text}\n${url}`, "링크를 복사했어요 — 붙여넣어 자랑하세요");
    } catch {
      showToast("공유에 실패했어요");
    } finally {
      setBusy(false);
    }
  };

  const saveImage = async () => {
    setBusy(true);
    try {
      await downloadShareImage(record);
      showToast("이미지를 저장했어요");
    } catch {
      showToast("이미지 생성에 실패했어요");
    } finally {
      setBusy(false);
    }
  };

  const shareToX = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText(record))}&url=${encodeURIComponent(shareUrl())}`;
    window.open(url, "_blank", "noopener");
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden p-4 sm:items-center"
      style={{ background: "var(--flood)" }}
      onClick={onClose}
    >
      {/* 상하단 체커 패턴 */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-24 opacity-50"
        style={{
          background: "repeating-conic-gradient(var(--flood-deep) 0% 25%, transparent 0% 50%)",
          backgroundSize: "32px 32px",
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-24 opacity-50"
        style={{
          background: "repeating-conic-gradient(var(--flood-deep) 0% 25%, transparent 0% 50%)",
          backgroundSize: "32px 32px",
        }}
      />

      <motion.div
        initial={{ y: 60, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 28, delay: 0.1 }}
        className="relative w-full max-w-md pb-[env(safe-area-inset-bottom)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex flex-col items-center gap-1.5">
          <p
            className="font-display -rotate-2 text-[2.6rem] leading-none"
            style={{ color: "var(--on-flood)", textShadow: "4px 4px 0 #141414" }}
          >
            클리어!
          </p>
          <p className="text-[0.8rem] font-extrabold" style={{ color: "var(--pop)" }}>
            오늘 퍼즐 깼다. 자랑 각.
          </p>
        </div>

        {/* 풀이 리캡: 타임랩스 + 하이라이트 */}
        {record.moves && record.moves.length > 0 && puzzle && (
          <div
            className="mb-3 flex items-center gap-4 p-4"
            style={{
              background: "var(--surface)",
              border: "2px solid var(--edge)",
              borderRadius: "var(--r-lg)",
              boxShadow: "var(--shadow-md)",
            }}
          >
            <RecapBoard puzzle={puzzle} moves={record.moves} size={128} />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <p className="text-[0.66rem] font-extrabold tracking-widest" style={{ color: "var(--ink-faint)" }}>
                나의 풀이 리캡
              </p>
              {(() => {
                const h = computeHighlights(record.moves!);
                const rows: Array<[string, string]> = [
                  ...(h.longestThink
                    ? ([["최장 고민", `${cellName(h.longestThink.i)} · ${h.longestThink.sec}초`]] as Array<[string, string]>)
                    : []),
                  ...(h.lastSpurt
                    ? ([["라스트 스퍼트", `마지막 ${h.lastSpurt.cells}칸 ${h.lastSpurt.sec}초`]] as Array<[string, string]>)
                    : []),
                  ["오답 칸", h.errorCells > 0 ? `${h.errorCells}곳` : "없음 (클린!)"],
                ];
                return rows.map(([label, value]) => (
                  <p key={label} className="truncate text-[0.74rem] font-bold leading-snug">
                    <span style={{ color: "var(--ink-faint)" }}>{label} </span>
                    <span style={{ color: "var(--ink)" }}>{value}</span>
                  </p>
                ));
              })()}
            </div>
          </div>
        )}

        <ShareCard record={record} />

        {/* 공유 버튼들 */}
        <div className="mt-4 flex flex-col gap-2.5">
          <button
            onClick={shareStory}
            disabled={busy}
            className="chunky chunky-press flex items-center justify-center gap-2 py-3.5 text-[0.95rem] font-extrabold disabled:opacity-60"
            style={{ background: "var(--pop)", color: "var(--on-pop)", boxShadow: "var(--shadow-md)" }}
          >
            <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <path d="m16 6-4-4-4 4" />
              <path d="M12 2v13" />
            </svg>
            스토리에 자랑하기
          </button>
          <div className="flex gap-2.5">
            <button
              onClick={saveImage}
              disabled={busy}
              className="chunky-sm chunky-press flex flex-1 items-center justify-center gap-1.5 py-3 text-[0.78rem] font-extrabold disabled:opacity-60"
              style={{ color: "var(--ink)" }}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="9" cy="9" r="2" />
                <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
              </svg>
              이미지 저장
            </button>
            <button
              onClick={() => copyToClipboard(shareText(record, shareUrl()), "기록을 복사했어요")}
              className="chunky-sm chunky-press flex flex-1 items-center justify-center gap-1.5 py-3 text-[0.78rem] font-extrabold"
              style={{ color: "var(--ink)" }}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              링크 복사
            </button>
            <button
              onClick={shareToX}
              aria-label="X에 공유"
              className="chunky-sm chunky-press flex w-14 items-center justify-center"
              style={{ color: "var(--ink)" }}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.9 2.1h3.7l-8.1 9.3L24 21.9h-7.5l-5.9-7.7-6.7 7.7H.2l8.7-9.9L0 2.1h7.7l5.3 7 6-7Zm-1.3 17.6h2L7.1 4.2H5l12.6 15.5Z" />
              </svg>
            </button>
          </div>
          <div className="mt-1 flex items-center justify-center gap-5">
            <button
              onClick={onNewGame}
              className="text-[0.82rem] font-extrabold underline underline-offset-4"
              style={{ color: "var(--on-flood)" }}
            >
              한 판 더 →
            </button>
            <button onClick={onClose} className="text-[0.82rem] font-bold opacity-80" style={{ color: "var(--on-flood)" }}>
              닫기
            </button>
          </div>
        </div>

        {toast && (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 rounded-full px-4 py-2 text-center text-[0.78rem] font-extrabold"
            style={{ background: "var(--ink)", color: "var(--ground)" }}
          >
            {toast}
          </motion.p>
        )}
      </motion.div>
    </motion.div>
  );
}
