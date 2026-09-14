"use client";

import { MAX_HINTS } from "@/lib/useGame";

interface ControlsProps {
  noteMode: boolean;
  hintsUsed: number;
  hintsDisabled?: boolean; // 실시간 대결 중엔 힌트 없음
  onUndo: () => void;
  onErase: () => void;
  onToggleNote: () => void;
  onHint: () => void;
}

function ControlButton({
  label,
  active,
  badge,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  badge?: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      className="chunky-sm chunky-press relative flex min-h-14 flex-1 flex-col items-center justify-center gap-1 disabled:opacity-30"
      style={{
        background: active ? "var(--pop)" : "var(--surface)",
        color: active ? "var(--on-pop)" : "var(--ink)",
      }}
    >
      {children}
      <span className="text-[0.66rem] font-extrabold leading-none">{active ? `${label} ON` : label}</span>
      {badge && (
        <span
          className="tabular absolute -right-1.5 -top-2 flex h-5 w-5 items-center justify-center rounded-full text-[0.6rem] font-extrabold leading-none"
          style={{ background: "var(--primary)", color: "var(--on-primary)", border: "2px solid var(--edge)" }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

const icon = "h-4.5 w-4.5";

export default function Controls({ noteMode, hintsUsed, hintsDisabled, onUndo, onErase, onToggleNote, onHint }: ControlsProps) {
  return (
    <div className="flex w-full gap-2">
      <ControlButton label="되돌리기" onClick={onUndo}>
        <svg className={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 14 4 9l5-5" />
          <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
        </svg>
      </ControlButton>
      <ControlButton label="지우기" onClick={onErase}>
        <svg className={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
          <path d="M22 21H7" />
        </svg>
      </ControlButton>
      <ControlButton label="메모" active={noteMode} onClick={onToggleNote}>
        <svg className={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
        </svg>
      </ControlButton>
      <ControlButton
        label={hintsDisabled ? "힌트 없음" : "힌트"}
        onClick={onHint}
        disabled={hintsDisabled || hintsUsed >= MAX_HINTS}
        badge={hintsDisabled ? undefined : `${MAX_HINTS - hintsUsed}`}
      >
        <svg className={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
          <path d="M9 18h6" />
          <path d="M10 22h4" />
        </svg>
      </ControlButton>
    </div>
  );
}
