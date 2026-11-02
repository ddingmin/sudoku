"use client";

interface NumberPadProps {
  remaining: number[]; // index 1~9
  noteMode: boolean;
  onInput: (n: number) => void;
  onErase: () => void;
}

// 세로: 5열 2행(1-5 / 6-9 + 지우기). 넓은 화면 레일: 3열(1-9) + 전폭 지우기
export default function NumberPad({ remaining, noteMode, onInput, onErase }: NumberPadProps) {
  return (
    <div className="game-pad grid w-full auto-rows-fr grid-cols-5 gap-2 wide:grid-cols-3">
      {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => {
        const done = remaining[n] <= 0;
        return (
          <button
            key={n}
            onClick={() => onInput(n)}
            disabled={done && !noteMode}
            aria-label={`숫자 ${n}${done ? " (모두 배치됨)" : ""}`}
            className="chunky-sm chunky-press key flex min-h-[var(--key-min,52px)] flex-col items-center justify-center wide:min-h-0"
          >
            <span
              className="key-n font-display leading-none"
              style={{ color: done ? "var(--ink-faint)" : noteMode ? "var(--ink-soft)" : "var(--primary)" }}
            >
              {n}
            </span>
            <span className="key-c tabular flex items-center font-bold leading-none" style={{ color: "var(--ink-faint)" }}>
              {done ? (
                <svg className="h-[1em] w-[1em]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              ) : (
                remaining[n]
              )}
            </span>
          </button>
        );
      })}
      <button
        onClick={onErase}
        aria-label="지우기"
        className="chunky-sm chunky-press key flex min-h-[var(--key-min,52px)] flex-col items-center justify-center wide:col-span-3 wide:min-h-0"
        style={{ color: "var(--ink)" }}
      >
        <svg className="erase-i" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
          <path d="M22 21H7" />
        </svg>
        <span className="erase-l font-extrabold leading-none">지우기</span>
      </button>
    </div>
  );
}
