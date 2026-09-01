"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "@/lib/useGame";
import { Difficulty, colOf, rowOf } from "@/lib/sudoku";
import { Stats, loadStats, recordClear, recordStart } from "@/lib/stats";
import { ShareRecord } from "@/lib/encode";
import Board from "@/components/Board";
import NumberPad from "@/components/NumberPad";
import Controls from "@/components/Controls";
import Header from "@/components/Header";
import WinModal from "@/components/WinModal";
import StatsPanel from "@/components/StatsPanel";
import { Emblem } from "@/components/ShareCard";

export default function Home() {
  const game = useGame({ difficulty: "normal", daily: true });
  const { state, fx, remaining, puzzleGrid, seed, getMoves, select, input, erase, undo, hint, toggleNoteMode, newGame } = game;

  const [winRecord, setWinRecord] = useState<ShareRecord | null>(null);
  const [statsOpen, setStatsOpen] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const recordedRef = useRef(false);

  // 게임 시작 기록
  useEffect(() => {
    setStats(recordStart());
  }, []);

  const startNewGame = useCallback(
    (diff: Difficulty, daily: boolean) => {
      newGame(diff, daily);
      setWinRecord(null);
      recordedRef.current = false;
      setStats(recordStart());
    },
    [newGame],
  );

  // 클리어 → 기록 저장 → 웨이브가 끝난 뒤 모달
  useEffect(() => {
    if (state?.status !== "won" || recordedRef.current) return;
    recordedRef.current = true;
    const { stats: s, record } = recordClear({
      difficulty: state.difficulty,
      timeSec: state.elapsed,
      mistakes: state.mistakes,
      hints: state.hintsUsed,
      dateKey: state.dateKey,
      daily: state.daily,
      finishedAt: Date.now(),
    });
    setStats(s);
    const full = { ...record, seed, moves: getMoves() };
    const t = setTimeout(() => setWinRecord(full), 1500);
    return () => clearTimeout(t);
  }, [state?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // 키보드 입력
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!state || winRecord || statsOpen) return;
      if (e.key >= "1" && e.key <= "9") {
        input(Number(e.key));
      } else if (e.key === "Backspace" || e.key === "Delete") {
        erase();
      } else if (e.key === "n" || e.key === "N") {
        toggleNoteMode();
      } else if (e.key === "h" || e.key === "H") {
        hint();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        undo();
      } else if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        const cur = state.selected ?? 40;
        let r = rowOf(cur);
        let c = colOf(cur);
        if (e.key === "ArrowUp") r = Math.max(0, r - 1);
        if (e.key === "ArrowDown") r = Math.min(8, r + 1);
        if (e.key === "ArrowLeft") c = Math.max(0, c - 1);
        if (e.key === "ArrowRight") c = Math.min(8, c + 1);
        select(r * 9 + c);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, winRecord, statsOpen, input, erase, toggleNoteMode, hint, undo, select]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center gap-4 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
      {state ? (
        <>
          <Header
            difficulty={state.difficulty}
            daily={state.daily}
            dateKey={state.dateKey}
            elapsed={state.elapsed}
            mistakes={state.mistakes}
            onNewGame={startNewGame}
            onOpenStats={() => {
              setStats(loadStats());
              setStatsOpen(true);
            }}
          />

          <div className="flex w-full flex-1 items-center">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="mx-auto w-full"
              style={{ maxWidth: "min(100%, calc(100dvh - 330px))" }}
            >
              <Board
                values={state.values}
                notes={state.notes}
                given={state.given}
                solution={state.solution}
                selected={state.selected}
                fx={fx}
                onSelect={select}
              />
            </motion.div>
          </div>

          <div className="flex w-full flex-col gap-2.5">
            <Controls
              noteMode={state.noteMode}
              hintsUsed={state.hintsUsed}
              onUndo={undo}
              onErase={erase}
              onToggleNote={toggleNoteMode}
              onHint={hint}
            />
            <NumberPad remaining={remaining} noteMode={state.noteMode} onInput={input} />
          </div>

          <div className="flex items-center justify-center gap-2 pb-1">
            <span className="checker h-2 w-11" />
            <p className="text-center text-[0.65rem] font-bold" style={{ color: "var(--ink-faint)" }}>
              새로운 스도쿠는 자정에 열려요
            </p>
            <span className="checker h-2 w-11" />
          </div>
        </>
      ) : (
        // 퍼즐 생성 중 스켈레톤
        <div className="flex min-h-dvh w-full flex-col items-center justify-center gap-4">
          <motion.div animate={{ opacity: [0.4, 1, 0.4], rotate: [0, 90, 90] }} transition={{ repeat: Infinity, duration: 1.6 }}>
            <Emblem size={44} />
          </motion.div>
          <p className="text-sm font-extrabold" style={{ color: "var(--ink-faint)" }}>
            판 까는 중…
          </p>
        </div>
      )}

      <AnimatePresence>
        {winRecord && (
          <WinModal
            record={winRecord}
            puzzle={puzzleGrid}
            onNewGame={() => startNewGame(state!.difficulty, false)}
            onClose={() => setWinRecord(null)}
          />
        )}
        {statsOpen && stats && <StatsPanel stats={stats} onClose={() => setStatsOpen(false)} />}
      </AnimatePresence>
    </main>
  );
}
