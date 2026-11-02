"use client";

import { MAX_HINTS } from "@/lib/useGame";

interface ControlsProps {
  noteMode: boolean;
  hintsUsed: number;
  hintsDisabled?: boolean; // 실시간 대결 중엔 힌트 없음
  onUndo: () => void;
  onToggleNote: () => void;
  onHint: () => void;
}

// 도구 버튼: 보더만(.flat-box), 아이콘 + 라벨 가로 배치, 높이 44px
function ToolButton({
  label,
  text,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string; // aria-label
  text: string; // 보이는 라벨
  active?: boolean;
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
      className="flat-box flex h-11 min-w-0 items-center justify-center gap-1.5 px-2 text-[0.8rem] font-extrabold"
      style={active ? { background: "var(--pop)", color: "var(--on-pop)" } : undefined}
    >
      {children}
      <span className="truncate leading-none">{text}</span>
    </button>
  );
}

const icon = "h-[18px] w-[18px] shrink-0";

export default function Controls({ noteMode, hintsUsed, hintsDisabled, onUndo, onToggleNote, onHint }: ControlsProps) {
  return (
    <div className="game-tools grid w-full grid-cols-3 gap-2">
      <ToolButton label="되돌리기" text="되돌리기" onClick={onUndo}>
        <svg className={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 14 4 9l5-5" />
          <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
        </svg>
      </ToolButton>
      <ToolButton label="메모" text={noteMode ? "메모 ON" : "메모"} active={noteMode} onClick={onToggleNote}>
        <svg className={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
        </svg>
      </ToolButton>
      <ToolButton
        label="힌트"
        text={hintsDisabled ? "힌트 없음" : `힌트 ${MAX_HINTS - hintsUsed}`}
        onClick={onHint}
        disabled={hintsDisabled || hintsUsed >= MAX_HINTS}
      >
        <svg className={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
          <path d="M9 18h6" />
          <path d="M10 22h4" />
        </svg>
      </ToolButton>
    </div>
  );
}
