"use client";

interface NumberPadProps {
  remaining: number[]; // index 1~9
  noteMode: boolean;
  onInput: (n: number) => void;
}

export default function NumberPad({ remaining, noteMode, onInput }: NumberPadProps) {
  return (
    <div className="grid w-full grid-cols-9 gap-1.5 sm:gap-2">
      {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => {
        const done = remaining[n] <= 0;
        return (
          <button
            key={n}
            onClick={() => onInput(n)}
            disabled={done && !noteMode}
            aria-label={`숫자 ${n}${done ? " (모두 배치됨)" : ""}`}
            className="chunky-sm chunky-press flex min-h-12 flex-col items-center justify-center gap-0.5 py-1.5 disabled:opacity-25 sm:min-h-14"
          >
            <span
              className="font-display leading-none"
              style={{
                fontSize: "clamp(1.2rem, 5.2vw, 1.6rem)",
                color: noteMode ? "var(--ink-soft)" : "var(--primary)",
              }}
            >
              {n}
            </span>
            <span className="tabular text-[0.6rem] font-bold leading-none" style={{ color: "var(--ink-faint)" }}>
              {done ? "·" : remaining[n]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
