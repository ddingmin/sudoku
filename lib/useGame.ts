"use client";

// 게임 상태 훅: 입력, 메모, 실행취소, 힌트, 타이머, 완성 이펙트 이벤트
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Difficulty,
  Grid,
  Puzzle,
  boxOf,
  colOf,
  generateDaily,
  generatePuzzle,
  rowOf,
  todayKey,
} from "./sudoku";
import { Move } from "./encode";

export const MAX_HINTS = 3;

export type GameStatus = "playing" | "won";

// 셀에 재생할 이펙트: 순차 딜레이(ms)를 셀별로 지정
export interface FxEvent {
  id: number;
  kind: "pop" | "error" | "ripple" | "clear";
  cells: Map<number, number>; // idx -> delay ms
}

interface HistoryEntry {
  idx: number;
  prevValue: number;
  prevNotes: number;
}

export interface GameState {
  values: number[];
  notes: number[]; // 비트마스크 (1<<n)
  given: boolean[];
  solution: Grid;
  selected: number | null;
  mistakes: number;
  hintsUsed: number;
  status: GameStatus;
  difficulty: Difficulty;
  daily: boolean;
  dateKey: string;
  elapsed: number;
  noteMode: boolean;
}

function unitCells(kind: "row" | "col" | "box", n: number): number[] {
  const out: number[] = [];
  for (let k = 0; k < 9; k++) {
    if (kind === "row") out.push(n * 9 + k);
    else if (kind === "col") out.push(k * 9 + n);
    else out.push((Math.floor(n / 3) * 3 + Math.floor(k / 3)) * 9 + (n % 3) * 3 + (k % 3));
  }
  return out;
}

// ── 진행 상태 저장/복원 ──
// 모바일에서 앱 전환 시 브라우저가 탭을 내리면 페이지가 재로드되어
// 진행이 초기화되는 문제를 막는다. 게임별 슬롯에 저장하고 로드 시 복원.
interface SavedGame {
  seed: number;
  difficulty: Difficulty;
  daily: boolean;
  dateKey: string;
  values: number[];
  notes: number[];
  mistakes: number;
  hintsUsed: number;
  elapsed: number;
  noteMode: boolean;
  moves: Move[];
  savedAt: number;
}

const SAVES_KEY = "sudoku:games:v1";
const CURRENT_KEY = "sudoku:current:v1";

function gameKey(daily: boolean, difficulty: Difficulty, dateKey: string, seed: number): string {
  return daily ? `d:${difficulty}:${dateKey}` : `f:${seed}`;
}

function loadSaves(): Record<string, SavedGame> {
  try {
    return JSON.parse(localStorage.getItem(SAVES_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function writeSaves(saves: Record<string, SavedGame>) {
  try {
    // 3일 지난 슬롯 제거, 최근 10개만 유지
    const entries = Object.entries(saves)
      .filter(([, s]) => Date.now() - s.savedAt < 3 * 86400_000)
      .sort((a, b) => b[1].savedAt - a[1].savedAt)
      .slice(0, 10);
    localStorage.setItem(SAVES_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {}
}

function setCurrentKey(key: string | null) {
  try {
    if (key) localStorage.setItem(CURRENT_KEY, key);
    else localStorage.removeItem(CURRENT_KEY);
  } catch {}
}

function isSaveValid(s: SavedGame | undefined): s is SavedGame {
  if (!s || !Array.isArray(s.values) || s.values.length !== 81) return false;
  if (s.daily && s.dateKey !== todayKey()) return false; // 지난 데일리는 폐기
  return true;
}

export function useGame(
  initial: { difficulty: Difficulty; daily: boolean },
  onStart?: (fresh: boolean) => void,
) {
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [values, setValues] = useState<number[]>([]);
  const [notes, setNotes] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [status, setStatus] = useState<GameStatus>("playing");
  const [elapsed, setElapsed] = useState(0);
  const [noteMode, setNoteMode] = useState(false);
  const [daily, setDaily] = useState(initial.daily);
  const [difficulty, setDifficulty] = useState(initial.difficulty);
  const [dateKey, setDateKey] = useState(() => todayKey());
  const [fx, setFx] = useState<FxEvent | null>(null);
  const historyRef = useRef<HistoryEntry[]>([]);
  const fxIdRef = useRef(0);
  const movesRef = useRef<Move[]>([]); // 풀이 로그 (리캡/리플레이용)
  const elapsedRef = useRef(0);
  const currentKeyRef = useRef<string | null>(null);
  const onStartRef = useRef(onStart);
  onStartRef.current = onStart;

  const emitFx = useCallback((kind: FxEvent["kind"], cells: Map<number, number>) => {
    setFx({ id: ++fxIdRef.current, kind, cells });
  }, []);

  // 저장된 게임 복원
  const applySave = useCallback((saved: SavedGame) => {
    const p = generatePuzzle(saved.difficulty, saved.seed);
    setPuzzle(p);
    setValues([...saved.values]);
    setNotes([...saved.notes]);
    setSelected(null);
    setMistakes(saved.mistakes);
    setHintsUsed(saved.hintsUsed);
    setStatus("playing");
    setElapsed(saved.elapsed);
    setNoteMode(saved.noteMode);
    setDifficulty(saved.difficulty);
    setDaily(saved.daily);
    setDateKey(saved.dateKey);
    setFx(null);
    historyRef.current = [];
    movesRef.current = [...saved.moves];
    elapsedRef.current = saved.elapsed;
    currentKeyRef.current = gameKey(saved.daily, saved.difficulty, saved.dateKey, saved.seed);
    setCurrentKey(currentKeyRef.current);
    onStartRef.current?.(false);
  }, []);

  const newGame = useCallback(
    (diff: Difficulty, isDaily: boolean) => {
      const today = todayKey();
      // 오늘의 스도쿠는 진행 중이던 판이 있으면 이어서
      if (isDaily) {
        const saved = loadSaves()[gameKey(true, diff, today, 0)];
        if (isSaveValid(saved)) {
          applySave(saved);
          return;
        }
      }
      const p = isDaily ? generateDaily(diff) : generatePuzzle(diff, Math.floor(Math.random() * 2 ** 31));
      setPuzzle(p);
      setValues([...p.puzzle]);
      setNotes(new Array(81).fill(0));
      setSelected(null);
      setMistakes(0);
      setHintsUsed(0);
      setStatus("playing");
      setElapsed(0);
      setNoteMode(false);
      setDifficulty(diff);
      setDaily(isDaily);
      setDateKey(today);
      setFx(null);
      historyRef.current = [];
      movesRef.current = [];
      elapsedRef.current = 0;
      currentKeyRef.current = gameKey(isDaily, diff, today, p.seed);
      setCurrentKey(currentKeyRef.current);
      onStartRef.current?.(true);
    },
    [applySave],
  );

  // 초기 퍼즐: 진행 중이던 게임이 있으면 복원, 없으면 새 게임 (클라이언트 전용)
  useEffect(() => {
    try {
      const cur = localStorage.getItem(CURRENT_KEY);
      const saved = cur ? loadSaves()[cur] : undefined;
      if (isSaveValid(saved)) {
        applySave(saved);
        return;
      }
    } catch {}
    newGame(initial.difficulty, initial.daily);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 진행 상태 저장: 상태 변경 시 + 앱 전환/이탈 시
  const persistRef = useRef<() => void>(() => {});
  persistRef.current = () => {
    if (!puzzle || status !== "playing" || !currentKeyRef.current) return;
    const saves = loadSaves();
    saves[currentKeyRef.current] = {
      seed: puzzle.seed,
      difficulty,
      daily,
      dateKey,
      values,
      notes,
      mistakes,
      hintsUsed,
      elapsed: elapsedRef.current,
      noteMode,
      moves: movesRef.current,
      savedAt: Date.now(),
    };
    writeSaves(saves);
  };

  useEffect(() => {
    persistRef.current();
  }, [values, notes, mistakes, hintsUsed, noteMode, puzzle, status]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") persistRef.current();
    };
    const onPageHide = () => persistRef.current();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, []);

  // 클리어하면 저장 슬롯 정리
  useEffect(() => {
    if (status !== "won" || !currentKeyRef.current) return;
    const saves = loadSaves();
    delete saves[currentKeyRef.current];
    writeSaves(saves);
    setCurrentKey(null);
    currentKeyRef.current = null;
  }, [status]);

  // 타이머 (탭이 보일 때만)
  useEffect(() => {
    if (status !== "playing" || !puzzle) return;
    const t = setInterval(() => {
      if (!document.hidden)
        setElapsed((e) => {
          elapsedRef.current = e + 1;
          return e + 1;
        });
    }, 1000);
    return () => clearInterval(t);
  }, [status, puzzle]);

  const given = useMemo(() => (puzzle ? puzzle.puzzle.map((v) => v !== 0) : []), [puzzle]);

  // 숫자별 남은 개수 (9개 다 놓이면 패드에서 비활성)
  const remaining = useMemo(() => {
    const counts = new Array(10).fill(9);
    for (const v of values) if (v > 0) counts[v]--;
    return counts;
  }, [values]);

  const checkCompletions = useCallback(
    (idx: number, nextValues: number[], solution: Grid) => {
      const doneCells = new Map<number, number>();
      const units: Array<["row" | "col" | "box", number]> = [
        ["row", rowOf(idx)],
        ["col", colOf(idx)],
        ["box", boxOf(idx)],
      ];
      for (const [kind, n] of units) {
        const cells = unitCells(kind, n);
        if (cells.every((c) => nextValues[c] === solution[c])) {
          cells.forEach((c, i) => {
            const delay = i * 40;
            doneCells.set(c, Math.min(doneCells.get(c) ?? Infinity, delay));
          });
        }
      }

      const won = nextValues.every((v, i) => v === solution[i]);
      if (won) {
        // 클리어: 놓은 칸에서 퍼져나가는 웨이브
        const r0 = rowOf(idx);
        const c0 = colOf(idx);
        const wave = new Map<number, number>();
        for (let i = 0; i < 81; i++) {
          const d = Math.abs(rowOf(i) - r0) + Math.abs(colOf(i) - c0);
          wave.set(i, d * 55);
        }
        emitFx("clear", wave);
        setStatus("won");
        return;
      }
      if (doneCells.size > 0) emitFx("ripple", doneCells);
    },
    [emitFx],
  );

  const input = useCallback(
    (n: number) => {
      if (!puzzle || status !== "playing" || selected === null) return;
      if (given[selected]) return;

      if (noteMode) {
        if (values[selected] !== 0) return;
        historyRef.current.push({ idx: selected, prevValue: 0, prevNotes: notes[selected] });
        setNotes((prev) => {
          const next = [...prev];
          next[selected] ^= 1 << n;
          return next;
        });
        return;
      }

      if (values[selected] === n) return;
      historyRef.current.push({
        idx: selected,
        prevValue: values[selected],
        prevNotes: notes[selected],
      });

      const nextValues = [...values];
      nextValues[selected] = n;
      setValues(nextValues);
      setNotes((prev) => {
        const next = [...prev];
        next[selected] = 0;
        // 같은 행/열/박스의 메모에서 n 제거
        for (let i = 0; i < 81; i++) {
          if (rowOf(i) === rowOf(selected) || colOf(i) === colOf(selected) || boxOf(i) === boxOf(selected)) {
            next[i] &= ~(1 << n);
          }
        }
        return next;
      });

      if (puzzle.solution[selected] === n) {
        movesRef.current.push({ i: selected, k: 0, t: elapsedRef.current });
        emitFx("pop", new Map([[selected, 0]]));
        checkCompletions(selected, nextValues, puzzle.solution);
      } else {
        movesRef.current.push({ i: selected, k: 1, t: elapsedRef.current });
        setMistakes((m) => m + 1);
        emitFx("error", new Map([[selected, 0]]));
      }
    },
    [puzzle, status, selected, given, noteMode, values, notes, emitFx, checkCompletions],
  );

  const erase = useCallback(() => {
    if (!puzzle || status !== "playing" || selected === null || given[selected]) return;
    if (values[selected] === 0 && notes[selected] === 0) return;
    historyRef.current.push({
      idx: selected,
      prevValue: values[selected],
      prevNotes: notes[selected],
    });
    setValues((prev) => {
      const next = [...prev];
      next[selected] = 0;
      return next;
    });
    setNotes((prev) => {
      const next = [...prev];
      next[selected] = 0;
      return next;
    });
  }, [puzzle, status, selected, given, values, notes]);

  const undo = useCallback(() => {
    const entry = historyRef.current.pop();
    if (!entry || status !== "playing") return;
    setValues((prev) => {
      const next = [...prev];
      next[entry.idx] = entry.prevValue;
      return next;
    });
    setNotes((prev) => {
      const next = [...prev];
      next[entry.idx] = entry.prevNotes;
      return next;
    });
    setSelected(entry.idx);
  }, [status]);

  const hint = useCallback(() => {
    if (!puzzle || status !== "playing" || hintsUsed >= MAX_HINTS) return;
    // 선택된 빈 칸 우선, 아니면 무작위 빈/오답 칸
    let target = selected;
    if (target === null || given[target] || values[target] === puzzle.solution[target]) {
      const candidates: number[] = [];
      for (let i = 0; i < 81; i++) {
        if (!given[i] && values[i] !== puzzle.solution[i]) candidates.push(i);
      }
      if (candidates.length === 0) return;
      target = candidates[Math.floor(Math.random() * candidates.length)];
    }
    historyRef.current.push({ idx: target, prevValue: values[target], prevNotes: notes[target] });
    const nextValues = [...values];
    nextValues[target] = puzzle.solution[target];
    setValues(nextValues);
    setNotes((prev) => {
      const next = [...prev];
      next[target] = 0;
      return next;
    });
    setSelected(target);
    setHintsUsed((h) => h + 1);
    movesRef.current.push({ i: target, k: 2, t: elapsedRef.current });
    emitFx("pop", new Map([[target, 0]]));
    checkCompletions(target, nextValues, puzzle.solution);
  }, [puzzle, status, hintsUsed, selected, given, values, notes, emitFx, checkCompletions]);

  const state: GameState | null = puzzle
    ? {
        values,
        notes,
        given,
        solution: puzzle.solution,
        selected,
        mistakes,
        hintsUsed,
        status,
        difficulty,
        daily,
        dateKey,
        elapsed,
        noteMode,
      }
    : null;

  return {
    state,
    fx,
    remaining,
    puzzleGrid: puzzle?.puzzle ?? null,
    seed: puzzle?.seed,
    getMoves: () => movesRef.current,
    select: setSelected,
    input,
    erase,
    undo,
    hint,
    toggleNoteMode: () => setNoteMode((m) => !m),
    newGame,
  };
}
