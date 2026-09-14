"use client";

// 실시간 대결 로비 — 난이도 고르기 → 방 만들기 → 링크 공유 → 친구 기다리기. 참가자 쪽은 "참가하는 중"
import { useState } from "react";
import { motion } from "framer-motion";
import { DIFFICULTIES, DIFFICULTY_LABEL, Difficulty } from "@/lib/sudoku";

export type LobbyPhase = "pick" | "creating" | "waiting" | "joining" | "error";

interface RoomLobbyProps {
  phase: LobbyPhase;
  difficulty: Difficulty;
  roomUrl: string | null;
  error: string | null;
  onCreate: (difficulty: Difficulty) => void;
  onCancel: () => void;
}

export default function RoomLobby({ phase, difficulty, roomUrl, error, onCreate, onCancel }: RoomLobbyProps) {
  const [picked, setPicked] = useState<Difficulty>(difficulty);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const share = async () => {
    if (!roomUrl) return;
    const text = `스도쿠 실시간 대결 · ${DIFFICULTY_LABEL[picked]}\n같은 문제를 동시에 풀어요. 링크를 열면 바로 시작돼요.`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "스도쿠 실시간 대결", text, url: roomUrl });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${roomUrl}`);
      showToast("대결 링크를 복사했어요");
    } catch {
      showToast("복사에 실패했어요");
    }
  };

  const copy = async () => {
    if (!roomUrl) return;
    try {
      await navigator.clipboard.writeText(roomUrl);
      showToast("링크를 복사했어요");
    } catch {
      showToast("복사에 실패했어요");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      style={{ background: "color-mix(in srgb, var(--ink) 45%, transparent)", backdropFilter: "blur(6px)" }}
      onClick={phase === "pick" || phase === "error" ? onCancel : undefined}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        className="w-full max-w-md p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        style={{ background: "var(--ground)", border: "2.5px solid var(--edge)", borderRadius: "var(--r-xl)", boxShadow: "var(--shadow-xl)" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="친구와 실시간 대결"
      >
        <div className="flex items-center justify-between">
          <h2 className="swipe">
            <span className="font-display text-2xl">친구와 대결</span>
          </h2>
          <button onClick={onCancel} aria-label="닫기" className="chunky-sm chunky-press flex h-9 w-9 items-center justify-center" style={{ color: "var(--ink)" }}>
            <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {phase === "pick" && (
          <>
            <p className="mt-3 text-[0.8rem] font-bold leading-snug" style={{ color: "var(--ink-soft)" }}>
              같은 문제를 같은 순간에 풀어요. 친구가 채운 칸이 보드에 점으로 보이고, 먼저 다 푸는 쪽이 이겨요. 대결 중엔 힌트를 쓸 수 없어요.
            </p>
            <p className="mt-5 text-[0.68rem] font-extrabold uppercase tracking-wider" style={{ color: "var(--ink-faint)" }}>
              난이도
            </p>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {DIFFICULTIES.map((d) => {
                const active = d === picked;
                return (
                  <button
                    key={d}
                    onClick={() => setPicked(d)}
                    aria-pressed={active}
                    className="chunky-sm chunky-press py-3 text-[0.85rem] font-extrabold"
                    style={{ background: active ? "var(--pop)" : "var(--surface)", color: active ? "var(--on-pop)" : "var(--ink)" }}
                  >
                    {DIFFICULTY_LABEL[d]}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => onCreate(picked)}
              className="chunky chunky-press mt-5 flex w-full items-center justify-center gap-2 py-4 text-[1rem] font-extrabold"
              style={{ background: "var(--primary)", color: "var(--on-primary)", boxShadow: "var(--shadow-lg)" }}
            >
              방 만들기
            </button>
          </>
        )}

        {(phase === "creating" || phase === "joining") && (
          <div className="flex flex-col items-center gap-3 py-10">
            <motion.span className="checker h-8 w-8 rounded-lg" animate={{ rotate: [0, 90, 90] }} transition={{ repeat: Infinity, duration: 1.2 }} />
            <p className="text-[0.85rem] font-extrabold" style={{ color: "var(--ink-soft)" }}>
              {phase === "creating" ? "방을 만드는 중" : "참가하는 중"}
            </p>
          </div>
        )}

        {phase === "waiting" && roomUrl && (
          <>
            <div className="mt-4 flex items-center gap-2.5">
              <motion.span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: "var(--primary)" }}
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ repeat: Infinity, duration: 1.2 }}
                aria-hidden
              />
              <p className="text-[0.9rem] font-extrabold">친구를 기다리는 중</p>
              <span className="sticker ml-auto -rotate-3" style={{ background: "var(--primary)", color: "var(--on-primary)" }}>
                {DIFFICULTY_LABEL[difficulty]}
              </span>
            </div>
            <p className="mt-1.5 text-[0.78rem] font-bold leading-snug" style={{ color: "var(--ink-soft)" }}>
              링크를 보내면 친구가 열자마자 카운트다운이 시작돼요. 30분 안에 아무도 안 오면 방이 사라져요.
            </p>
            <div
              className="tabular mt-4 truncate px-3.5 py-3 text-[0.78rem] font-bold"
              style={{ background: "var(--surface)", border: "2px dashed var(--ink-faint)", borderRadius: "var(--r-md)", color: "var(--ink-soft)" }}
              aria-label="대결 링크"
            >
              {roomUrl.replace(/^https?:\/\//, "")}
            </div>
            <div className="mt-3 flex gap-2.5">
              <button
                onClick={share}
                className="chunky chunky-press flex flex-1 items-center justify-center gap-2 py-3.5 text-[0.95rem] font-extrabold"
                style={{ background: "var(--pop)", color: "var(--on-pop)", boxShadow: "var(--shadow-md)" }}
              >
                <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                  <path d="m16 6-4-4-4 4" />
                  <path d="M12 2v13" />
                </svg>
                링크 보내기
              </button>
              <button onClick={copy} aria-label="링크 복사" className="chunky chunky-press flex w-14 items-center justify-center" style={{ color: "var(--ink)" }}>
                <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
              </button>
            </div>
            <button onClick={onCancel} className="mt-4 w-full text-center text-[0.78rem] font-bold underline underline-offset-4" style={{ color: "var(--ink-faint)" }}>
              대결 취소
            </button>
          </>
        )}

        {phase === "error" && (
          <>
            <p className="mt-4 text-[0.9rem] font-extrabold">{error ?? "대결에 들어갈 수 없어요"}</p>
            <button onClick={onCancel} className="chunky chunky-press mt-5 w-full py-3.5 text-[0.95rem] font-extrabold" style={{ color: "var(--ink)" }}>
              홈으로
            </button>
          </>
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
