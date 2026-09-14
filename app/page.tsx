"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BootIntent, useGame } from "@/lib/useGame";
import { DIFFICULTIES, Difficulty, colOf, generatePuzzle, rowOf } from "@/lib/sudoku";
import { Stats, loadStats, recordClear, recordStart } from "@/lib/stats";
import { ShareRecord } from "@/lib/encode";
import { useRoom } from "@/lib/useRoom";
import { roomApi, roomUrl, saveToken } from "@/lib/roomClient";
import { encodeResult, isRoomId, opponentOf, outcomeFor, playerOf, playerTimeSec, resultFromView, rivalPresence } from "@/lib/room";
import { resultShareText } from "@/lib/duelText";
import { DIFFICULTY_LABEL } from "@/lib/sudoku";
import Board from "@/components/Board";
import NumberPad from "@/components/NumberPad";
import Controls from "@/components/Controls";
import Header from "@/components/Header";
import WinModal, { DuelInfo } from "@/components/WinModal";
import StatsPanel from "@/components/StatsPanel";
import DuelBar from "@/components/DuelBar";
import RoomLobby, { LobbyPhase } from "@/components/RoomLobby";
import { Countdown, RoomBanner, RoomEndModal } from "@/components/RoomOverlays";
import { Emblem } from "@/components/ShareCard";

// 해시로 들어온 진입 의도 (/#room=<방> · /#free=<난이도> · /#lobby). 읽고 나면 주소에서 지운다
let bootRoom: string | null = null;
let bootLobby = false;
function readBootIntent(): BootIntent | null {
  const h = new URLSearchParams(location.hash.slice(1));
  const room = h.get("room");
  const free = h.get("free");
  const lobby = h.has("lobby");
  if (!room && !free && !lobby) return null;
  history.replaceState(null, "", location.pathname);
  if (room && isRoomId(room)) {
    bootRoom = room;
    return { room };
  }
  if (lobby) bootLobby = true;
  if (free && (DIFFICULTIES as string[]).includes(free)) return { free: free as Difficulty };
  return null;
}

export default function Home() {
  const game = useGame(
    { difficulty: "normal", daily: true },
    (fresh) => {
      // 새 게임만 플레이 수에 집계 (복원된 게임은 제외)
      setStats(fresh ? recordStart() : loadStats());
    },
    readBootIntent,
  );
  const { state, fx, remaining, puzzleGrid, seed, getMoves, select, input, erase, undo, hint, toggleNoteMode, newGame, newRoomGame, syncElapsed, clearRoomSave } = game;

  const [winRecord, setWinRecord] = useState<ShareRecord | null>(null);
  const [statsOpen, setStatsOpen] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [reviewRecord, setReviewRecord] = useState<ShareRecord | null>(null); // 기록 화면에서 고른 지난 판
  const recordedRef = useRef(false);

  // ── 실시간 대결 ──
  const [roomId, setRoomId] = useState<string | null>(null);
  const [lobby, setLobby] = useState<LobbyPhase | null>(null);
  const [lobbyDifficulty, setLobbyDifficulty] = useState<Difficulty>("normal");
  const [lobbyError, setLobbyError] = useState<string | null>(null);
  const [rematchPending, setRematchPending] = useState(false);
  const [endDismissed, setEndDismissed] = useState(false);
  const room = useRoom(roomId);
  const view = room.view;
  const me = view?.me ?? "host";
  const myPlayer = view ? playerOf(view, me) : undefined;
  const rival = view ? playerOf(view, opponentOf(me)) : undefined;
  const now = room.serverNow();

  // 해시 진입: 방 참가 / 로비 열기
  useEffect(() => {
    if (bootRoom) {
      setRoomId(bootRoom);
      setLobby("joining");
      bootRoom = null;
    } else if (bootLobby) {
      setLobby("pick");
      bootLobby = false;
    } else if (state?.room && !roomId) {
      // 새로고침으로 복원된 대결 슬롯 → 재접속
      setRoomId(state.room);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.room]);

  const reviewPuzzle = useMemo(() => {
    if (!reviewRecord || reviewRecord.seed === undefined) return null;
    try {
      return generatePuzzle(reviewRecord.difficulty, reviewRecord.seed).puzzle;
    } catch {
      return null;
    }
  }, [reviewRecord]);

  const startNewGame = useCallback(
    (diff: Difficulty, daily: boolean) => {
      newGame(diff, daily);
      setWinRecord(null);
      recordedRef.current = false;
    },
    [newGame],
  );

  // 방을 떠나 일반 게임으로
  const exitRoom = useCallback(
    async (forfeit: boolean) => {
      const id = roomId;
      if (forfeit) await room.leave();
      if (id) clearRoomSave(id);
      setRoomId(null);
      setLobby(null);
      setLobbyError(null);
      setEndDismissed(false);
      setRematchPending(false);
      startNewGame(state?.difficulty ?? "normal", true);
    },
    [roomId, room, clearRoomSave, startNewGame, state?.difficulty],
  );

  // 다른 방으로 (재대결)
  const goRoom = useCallback(
    (id: string) => {
      if (roomId) clearRoomSave(roomId);
      setWinRecord(null);
      recordedRef.current = false;
      setEndDismissed(false);
      setRematchPending(false);
      setRoomId(id);
      setLobby("joining");
    },
    [roomId, clearRoomSave],
  );

  // 로비: 방 만들기
  const createRoom = useCallback(async (difficulty: Difficulty) => {
    setLobby("creating");
    setLobbyDifficulty(difficulty);
    try {
      const r = await roomApi.create(difficulty);
      saveToken(r.id, r.token);
      setRoomId(r.id);
      setLobby("waiting");
    } catch (e) {
      setLobbyError(e instanceof Error ? e.message : "방을 만들지 못했어요");
      setLobby("error");
    }
  }, []);

  // 방 상태에 따라 게임을 깔고 로비를 정리
  useEffect(() => {
    if (!view || !roomId) return;
    if (view.status === "waiting") {
      setLobbyDifficulty(view.difficulty);
      setLobby("waiting");
      return;
    }
    if (view.status === "countdown" || view.status === "playing" || view.status === "finished") {
      if (state?.room !== view.id) {
        newRoomGame({ id: view.id, difficulty: view.difficulty, seed: view.seed });
        recordedRef.current = false;
        setWinRecord(null);
      }
      setLobby(null);
    }
    if (view.status === "abandoned") {
      if (state?.room === view.id && view.endedReason === "expired" && view.guest) return; // 진행 중 양쪽 끊김 → 종료 모달에서 처리
      setLobbyError("친구가 오지 않아 방이 닫혔어요");
      setLobby("error");
    }
  }, [view, roomId, state?.room, newRoomGame]);

  // 참가 실패
  useEffect(() => {
    if (room.error && roomId && !view) {
      setLobbyError(room.error);
      setLobby("error");
    }
  }, [room.error, roomId, view]);

  // 대결 타이머는 서버 시각 기준. 내가 완주했으면 그 시각에 고정
  useEffect(() => {
    if (!view || !state?.room || state.room !== view.id || !view.startAt) return;
    if (view.status !== "playing" && view.status !== "finished") return;
    const end = myPlayer?.finishedAt ?? now;
    const sec = Math.max(0, Math.floor((end - view.startAt) / 1000));
    if (sec !== state.elapsed) syncElapsed(sec);
  }, [now, view, state?.room, state?.elapsed, myPlayer?.finishedAt, syncElapsed]);

  // 진행 전송: 보드가 바뀔 때마다 (완성 시엔 즉시)
  useEffect(() => {
    if (!state?.room || !view || state.room !== view.id || myPlayer?.finishedAt) return;
    if (view.status !== "playing" && !(view.status === "finished" && view.endedReason === "forfeit")) return;
    room.sendProgress(state.values, state.mistakes, state.status === "won");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.values, state?.mistakes, state?.status]);

  // 완성했는데 서버 확인이 늦으면 2초마다 재전송
  useEffect(() => {
    if (!state?.room || state.status !== "won" || myPlayer?.finishedAt || !view) return;
    if (view.status !== "playing" && !(view.status === "finished" && view.endedReason === "forfeit")) return;
    const t = setInterval(() => room.sendProgress(state.values, state.mistakes, true), 2000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.status, myPlayer?.finishedAt, view?.status]);

  // 클리어 → 기록 저장 → 웨이브가 끝난 뒤 모달. 대결은 서버가 완주를 확인한 뒤(finishedAt)에만
  useEffect(() => {
    if (state?.status !== "won" || recordedRef.current) return;
    let timeSec = state.elapsed;
    if (state.room) {
      if (!view || !myPlayer?.finishedAt) return;
      timeSec = playerTimeSec(view, me) ?? state.elapsed;
    }
    recordedRef.current = true;
    const { stats: s, record } = recordClear({
      difficulty: state.difficulty,
      timeSec,
      mistakes: state.mistakes,
      hints: state.hintsUsed,
      dateKey: state.dateKey,
      daily: state.daily,
      finishedAt: Date.now(),
      seed,
      moves: getMoves(),
    });
    setStats(s);
    const t = setTimeout(() => setWinRecord(record), 1500);
    return () => clearTimeout(t);
  }, [state?.status, myPlayer?.finishedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  // 결과 모달용 대결 정보
  const duelInfo: DuelInfo | null = useMemo(() => {
    if (!view || !state?.room || state.room !== view.id || !rival) return null;
    const outcome = outcomeFor(view, me);
    if (!outcome) return null;
    const res = resultFromView(view);
    const url = res ? `${location.origin}/result/${encodeResult(res)}` : location.origin;
    const label = DIFFICULTY_LABEL[view.difficulty];
    const waitingRematch = !!view.rematchId;
    return {
      outcome,
      rival: { timeSec: playerTimeSec(view, opponentOf(me)), mistakes: rival.mistakes, hints: rival.hints },
      forfeit: view.endedReason === "forfeit",
      shareUrl: url,
      shareText: resultShareText(label, playerTimeSec(view, me), playerTimeSec(view, opponentOf(me)), outcome, view.endedReason === "forfeit"),
      rematch: {
        label: waitingRematch ? "친구가 기다려요 · 다시 붙기" : view.status === "finished" ? "다시 붙기" : "친구가 끝나면 다시 붙기",
        pending: rematchPending || view.status !== "finished",
        onClick: async () => {
          if (view.rematchId) return goRoom(view.rematchId);
          setRematchPending(true);
          const id = await room.rematch();
          setRematchPending(false);
          if (id) goRoom(id);
        },
      },
      onExit: () => exitRoom(false),
    };
  }, [view, state?.room, rival, me, rematchPending, room, goRoom, exitRoom]);

  // 내 기록 없이 끝난 대결 (친구 이탈로 승리 · 방 만료)
  const roomEnd = useMemo(() => {
    if (!view || !state?.room || state.room !== view.id || endDismissed) return null;
    if (myPlayer?.finishedAt) return null; // 내 기록이 있으면 WinModal이 처리
    if (view.status === "finished" && view.endedReason === "forfeit") {
      return { title: "이겼다!", message: "친구가 중간에 나갔어요. 이 판은 승리로 끝났어요." };
    }
    if (view.status === "abandoned") return { title: "끝났어요", message: "양쪽 연결이 끊겨 대결이 닫혔어요." };
    return null;
  }, [view, state?.room, myPlayer?.finishedAt, endDismissed]);

  // 친구 마커·진행
  const rivalCells = useMemo(() => (rival ? new Set(rival.cells) : null), [rival]);
  const progress = useMemo(() => {
    if (!state) return null;
    let mine = 0;
    let total = 0;
    for (let i = 0; i < 81; i++) {
      if (state.given[i]) continue;
      total++;
      if (state.values[i] === state.solution[i]) mine++;
    }
    return { mine, total };
  }, [state]);
  const inRoom = !!state?.room && !!view && state.room === view.id;
  const presence = view && inRoom ? rivalPresence(view, me, now) : "absent";
  const showCountdown = inRoom && view!.startAt !== undefined && (view!.status === "countdown" || now < view!.startAt + 700) && now < view!.startAt + 700;

  // 헤더에서 새 게임: 진행 중 대결이면 기권 확인
  const onHeaderNewGame = (diff: Difficulty, daily: boolean) => {
    if (inRoom && view && (view.status === "countdown" || view.status === "playing") && !myPlayer?.finishedAt) {
      if (!confirm("대결을 그만두면 기권 처리돼요. 나갈까요?")) return;
      void exitRoom(true).then(() => startNewGame(diff, daily));
      return;
    }
    if (roomId) {
      clearRoomSave(roomId);
      setRoomId(null);
    }
    startNewGame(diff, daily);
  };

  // 키보드 입력
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!state || winRecord || statsOpen || reviewRecord || lobby || roomEnd || showCountdown) return;
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
  }, [state, winRecord, statsOpen, reviewRecord, lobby, roomEnd, showCountdown, input, erase, toggleNoteMode, hint, undo, select]);

  const difficulty = state?.difficulty ?? view?.difficulty ?? "normal";

  return (
    <main
      data-difficulty={difficulty}
      className="mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center gap-4 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]"
    >
      {state ? (
        <>
          <Header
            difficulty={state.difficulty}
            daily={state.daily}
            dateKey={state.dateKey}
            elapsed={state.elapsed}
            mistakes={state.mistakes}
            duel={inRoom}
            onNewGame={onHeaderNewGame}
            onOpenDuel={() => {
              setLobbyError(null);
              setLobby("pick");
            }}
            onOpenStats={() => {
              setStats(loadStats());
              setStatsOpen(true);
            }}
          />

          <AnimatePresence>
            {inRoom && presence === "finished" && !myPlayer?.finishedAt && (
              <RoomBanner key="rival-done" tone="info">
                친구가 먼저 다 풀었어요. 끝까지 풀면 내 기록도 남아요.
              </RoomBanner>
            )}
            {inRoom && presence === "stale" && view!.status === "playing" && (
              <RoomBanner key="stale" tone="warn">
                친구 연결이 끊겼어요. 1분 안에 돌아오지 않으면 승리로 처리돼요.
              </RoomBanner>
            )}
            {inRoom && room.connection === "reconnecting" && room.reconnectingFor > 3000 && (
              <RoomBanner key="reconnect" tone="warn">
                서버와 다시 연결하는 중이에요.
              </RoomBanner>
            )}
          </AnimatePresence>

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
                rival={inRoom ? rivalCells : null}
                onSelect={select}
              />
            </motion.div>
          </div>

          <div className="flex w-full flex-col gap-2.5">
            <Controls
              noteMode={state.noteMode}
              hintsUsed={state.hintsUsed}
              hintsDisabled={inRoom}
              onUndo={undo}
              onErase={erase}
              onToggleNote={toggleNoteMode}
              onHint={hint}
            />
            <NumberPad remaining={remaining} noteMode={state.noteMode} onInput={input} />
          </div>

          {/* 대결 중엔 푸터 자리에 진행 스트립 — 보드 높이 예산은 일반 모드와 동일 */}
          {inRoom && progress && rival ? (
            <DuelBar
              mine={progress.mine}
              rival={rival.cells.length}
              total={progress.total}
              rivalTimeSec={playerTimeSec(view!, opponentOf(me))}
              rivalPresence={presence}
            />
          ) : (
            <div className="flex items-center justify-center gap-2 pb-1">
              <span className="checker h-2 w-11" />
              <p className="text-center text-[0.65rem] font-bold" style={{ color: "var(--ink-faint)" }}>
                매일 자정 새 문제
              </p>
              <span className="checker h-2 w-11" />
            </div>
          )}
        </>
      ) : (
        // 퍼즐 생성 중 스켈레톤
        <div className="flex min-h-dvh w-full flex-col items-center justify-center gap-4">
          <motion.div animate={{ opacity: [0.4, 1, 0.4], rotate: [0, 90, 90] }} transition={{ repeat: Infinity, duration: 1.6 }}>
            <Emblem size={44} />
          </motion.div>
          <p className="text-sm font-extrabold" style={{ color: "var(--ink-faint)" }}>
            {roomId ? "대결에 들어가는 중" : "불러오는 중"}
          </p>
        </div>
      )}

      <AnimatePresence>
        {showCountdown && view && <Countdown key="countdown" startAt={view.startAt!} now={now} difficulty={view.difficulty} />}
        {winRecord && (
          <WinModal
            key="win"
            record={winRecord}
            puzzle={puzzleGrid}
            duel={duelInfo}
            onNewGame={() => startNewGame(state!.difficulty, false)}
            onClose={() => setWinRecord(null)}
          />
        )}
        {roomEnd && !winRecord && (
          <RoomEndModal
            key="room-end"
            title={roomEnd.title}
            message={roomEnd.message}
            difficulty={difficulty}
            primary={
              view?.status === "finished"
                ? {
                    label: view.rematchId ? "친구가 기다려요 · 다시 붙기" : "다시 붙기",
                    pending: rematchPending,
                    onClick: async () => {
                      if (view.rematchId) return goRoom(view.rematchId);
                      setRematchPending(true);
                      const id = await room.rematch();
                      setRematchPending(false);
                      if (id) goRoom(id);
                    },
                  }
                : undefined
            }
            onExit={() => {
              setEndDismissed(true);
              void exitRoom(false);
            }}
          />
        )}
        {statsOpen && stats && <StatsPanel key="stats" stats={stats} onOpenRecord={setReviewRecord} onClose={() => setStatsOpen(false)} />}
        {reviewRecord && (
          <WinModal key="review" mode="review" record={reviewRecord} puzzle={reviewPuzzle} onNewGame={() => {}} onClose={() => setReviewRecord(null)} />
        )}
        {lobby && (
          <RoomLobby
            key="lobby"
            phase={lobby}
            difficulty={lobbyDifficulty}
            roomUrl={roomId ? roomUrl(roomId) : null}
            error={lobbyError}
            onCreate={createRoom}
            onCancel={() => {
              if (lobby === "waiting" || lobby === "joining") void exitRoom(true);
              else {
                setLobby(null);
                setLobbyError(null);
                if (roomId && !inRoom) setRoomId(null);
                if (!state) startNewGame("normal", true); // 초대 링크로 들어왔다 실패한 경우 — 빈 화면에 갇히지 않게
              }
            }}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
