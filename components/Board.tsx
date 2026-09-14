"use client";

import { memo } from "react";
import { boxOf, colOf, rowOf } from "@/lib/sudoku";
import { FxEvent } from "@/lib/useGame";

interface CellProps {
  idx: number;
  value: number;
  notes: number;
  given: boolean;
  wrong: boolean;
  selected: boolean;
  peer: boolean; // 같은 행/열/박스
  sameValue: boolean;
  fxKind: FxEvent["kind"] | null;
  fxDelay: number;
  fxId: number;
  rival: boolean; // 실시간 대결: 친구가 이미 채운 칸
  onSelect: (idx: number) => void;
}

const Cell = memo(function Cell({
  idx,
  value,
  notes,
  given,
  wrong,
  selected,
  peer,
  sameValue,
  fxKind,
  fxDelay,
  fxId,
  rival,
  onSelect,
}: CellProps) {
  const r = rowOf(idx);
  const c = colOf(idx);

  const style: React.CSSProperties = {
    borderRight: c === 8 ? "none" : c % 3 === 2 ? "2px solid var(--box-line)" : "1px solid var(--cell-line)",
    borderBottom: r === 8 ? "none" : r % 3 === 2 ? "2px solid var(--box-line)" : "1px solid var(--cell-line)",
  };

  let bg = "transparent";
  if (peer) bg = "var(--peer)";
  if (sameValue) bg = "var(--same)";
  if (wrong && !selected) bg = "var(--danger-wash)";
  if (selected) bg = "var(--pop)";

  let numColor = given ? "var(--ink)" : wrong ? "var(--danger)" : "var(--primary)";
  if (selected) numColor = wrong ? "var(--danger)" : "var(--on-pop)";

  return (
    <button
      style={style}
      onClick={() => onSelect(idx)}
      aria-label={`${r + 1}행 ${c + 1}열${value ? ` ${value}` : " 빈 칸"}`}
      className="relative flex items-center justify-center select-none"
    >
      <span className="absolute inset-0 transition-colors duration-150" style={{ background: bg }} />
      {/* 친구 마커: 친구가 채운 칸 — 숫자는 보이지 않고 위치만 */}
      {rival && value === 0 && (
        <span
          aria-hidden
          className="anim-pop pointer-events-none absolute right-[9%] top-[9%] rounded-[3px]"
          style={{ width: "24%", height: "24%", background: "var(--ink-faint)", opacity: 0.75 }}
        />
      )}
      {fxKind && fxKind !== "pop" && (
        <span
          key={`fx-${fxId}`}
          className={`pointer-events-none absolute inset-0 ${
            fxKind === "ripple" ? "anim-ripple" : fxKind === "clear" ? "anim-clear" : ""
          }`}
          style={{
            animationDelay: `${fxDelay}ms`,
            ...(fxKind === "error" ? { animation: "error-pulse 0.4s ease-in-out 2" } : {}),
          }}
        />
      )}
      {value > 0 ? (
        <span
          key={`v-${value}-${fxId}-${fxKind}`}
          className={`relative leading-none font-extrabold ${
            fxKind === "pop" ? "anim-pop" : fxKind === "error" ? "anim-shake" : ""
          }`}
          style={{ color: numColor, fontSize: "clamp(1.1rem, 4.4vmin, 1.7rem)" }}
        >
          {value}
        </span>
      ) : (
        notes > 0 && (
          <span className="relative grid h-full w-full grid-cols-3 grid-rows-3 p-[6%]">
            {Array.from({ length: 9 }, (_, i) => (
              <span
                key={i}
                className="tabular flex items-center justify-center leading-none font-bold"
                style={{
                  fontSize: "clamp(0.42rem, 1.55vmin, 0.62rem)",
                  color: "var(--ink-faint)",
                }}
              >
                {notes & (1 << (i + 1)) ? i + 1 : ""}
              </span>
            ))}
          </span>
        )
      )}
    </button>
  );
});

interface BoardProps {
  values: number[];
  notes: number[];
  given: boolean[];
  solution: number[];
  selected: number | null;
  fx: FxEvent | null;
  rival?: Set<number> | null; // 실시간 대결에서 친구가 채운 칸
  onSelect: (idx: number) => void;
}

export default function Board({ values, notes, given, solution, selected, fx, rival, onSelect }: BoardProps) {
  const selRow = selected !== null ? rowOf(selected) : -1;
  const selCol = selected !== null ? colOf(selected) : -1;
  const selBox = selected !== null ? boxOf(selected) : -1;
  const selValue = selected !== null ? values[selected] : 0;

  return (
    <div
      role="grid"
      aria-label="스도쿠 보드"
      className="grid aspect-square w-full grid-cols-9 grid-rows-9 overflow-hidden"
      style={{
        background: "var(--surface)",
        border: "2.5px solid var(--edge)",
        borderRadius: "var(--r-lg)",
        boxShadow: "var(--shadow-lg)",
      }}
    >
      {values.map((value, idx) => {
        const fxHas = fx?.cells.has(idx) ?? false;
        return (
          <Cell
            key={idx}
            idx={idx}
            value={value}
            notes={notes[idx]}
            given={given[idx]}
            wrong={value !== 0 && value !== solution[idx]}
            selected={selected === idx}
            peer={
              selected !== null &&
              selected !== idx &&
              (rowOf(idx) === selRow || colOf(idx) === selCol || boxOf(idx) === selBox)
            }
            sameValue={selValue !== 0 && value === selValue && selected !== idx}
            fxKind={fxHas ? fx!.kind : null}
            fxDelay={fxHas ? fx!.cells.get(idx)! : 0}
            fxId={fx?.id ?? 0}
            rival={rival?.has(idx) ?? false}
            onSelect={onSelect}
          />
        );
      })}
    </div>
  );
}
