// 대결 결과 카드 — 양쪽 기록을 나란히. WinModal / 결과 랜딩 공용 (서버 렌더 가능)
import { ShareRecord, formatTime } from "@/lib/encode";
import { DIFFICULTY_LABEL, dailyNumber } from "@/lib/sudoku";
import { gapText, judge } from "@/lib/duel";

export interface DuelSide {
  label: string; // "나" / "상대" / "도전장" / "답장"
  timeSec: number;
  mistakes: number;
  hints: number;
}

export default function DuelResultCard({ record, left, right }: { record: ShareRecord; left: DuelSide; right: DuelSide }) {
  const outcome = judge(left.timeSec, right.timeSec);

  const side = (s: DuelSide, won: boolean) => (
    <div
      className="relative flex flex-1 flex-col items-center gap-1.5 px-2 py-3.5"
      style={{
        background: won ? "var(--primary)" : "var(--ground)",
        color: won ? "var(--on-primary)" : "var(--ink)",
        border: "2px solid var(--edge)",
        borderRadius: "var(--r-md)",
      }}
    >
      {won && (
        <span
          className="sticker absolute -top-3 -right-2 rotate-6"
          style={{ background: "var(--pop)", color: "var(--on-pop)", fontSize: "0.62rem", padding: "5px 9px" }}
        >
          WIN
        </span>
      )}
      <span className="text-[0.62rem] font-extrabold tracking-widest" style={{ opacity: 0.8 }}>
        {s.label}
      </span>
      <span className="font-display tabular text-[1.9rem] leading-none">{formatTime(s.timeSec)}</span>
      <span className="tabular text-[0.66rem] font-bold" style={{ opacity: 0.85 }}>
        실수 {s.mistakes} · 힌트 {s.hints}
      </span>
    </div>
  );

  return (
    <div
      className="relative w-full p-5"
      style={{
        background: "var(--surface)",
        border: "2.5px solid var(--edge)",
        borderRadius: "var(--r-xl)",
        boxShadow: "var(--shadow-xl)",
      }}
    >
      <div className="flex items-center justify-between">
        <span className="font-display text-xl leading-none">스도쿠</span>
        <span className="text-[0.68rem] font-bold" style={{ color: "var(--ink-faint)" }}>
          {record.daily ? `#${dailyNumber(record.dateKey)} · ` : "자유 스도쿠 · "}
          {DIFFICULTY_LABEL[record.difficulty]}
        </span>
      </div>

      <div className="mt-4 flex items-stretch gap-2">
        {side(left, outcome === "win")}
        <div className="flex items-center">
          <span className="font-display -rotate-6 text-[1.1rem]" style={{ color: "var(--ink-faint)" }}>
            VS
          </span>
        </div>
        {side(right, outcome === "lose")}
      </div>

      <p className="mt-3.5 text-center text-[0.78rem] font-extrabold" style={{ color: "var(--ink-soft)" }}>
        {outcome === "tie" ? "완전히 같은 시간이에요" : `${gapText(left.timeSec, right.timeSec)}로 ${outcome === "win" ? left.label : right.label} 승`}
      </p>
    </div>
  );
}
