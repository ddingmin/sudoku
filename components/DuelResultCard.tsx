// 대결 결과 카드 — 양쪽 기록을 나란히. WinModal / 결과 랜딩 공용 (서버 렌더 가능)
import { ShareRecord, formatTime } from "@/lib/encode";
import { DIFFICULTY_LABEL, dailyNumber } from "@/lib/sudoku";
import { verdictText } from "@/lib/duelText";

export interface DuelSide {
  label: string; // "나" / "친구"
  subject: string; // 승패 문장의 주어: "내 기록이" / "친구 기록이"
  timeSec: number | null; // null = 완주하지 못함(기권·이탈)
  mistakes: number;
  hints: number;
}

interface Props {
  record: Pick<ShareRecord, "daily" | "dateKey" | "difficulty">;
  left: DuelSide;
  right: DuelSide;
  leftWon: boolean; // 왼쪽이 승자인가 (시간 비교가 아니라 서버 판정을 그대로 받는다)
  forfeit?: boolean;
  title?: string; // 헤더 오른쪽 라벨. 기본은 "#N · 난이도" / "자유 스도쿠 · 난이도"
}

const who = (label: string) => (label === "나" ? "내가" : `${label}가`);

export default function DuelResultCard({ record, left, right, leftWon, forfeit, title }: Props) {
  const tie = left.timeSec !== null && right.timeSec !== null && left.timeSec === right.timeSec;

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
      <span className="font-display tabular text-[1.9rem] leading-none">{s.timeSec !== null ? formatTime(s.timeSec) : "—"}</span>
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
          {title ?? `${record.daily ? `#${dailyNumber(record.dateKey)}` : "자유 스도쿠"} · ${DIFFICULTY_LABEL[record.difficulty]}`}
        </span>
      </div>

      <div className="mt-4 flex items-stretch gap-2">
        {side(left, !tie && leftWon)}
        <div className="flex items-center">
          <span className="font-display -rotate-6 text-[1.1rem]" style={{ color: "var(--ink-faint)" }}>
            VS
          </span>
        </div>
        {side(right, !tie && !leftWon)}
      </div>

      <p className="mt-3.5 text-center text-[0.78rem] font-extrabold" style={{ color: "var(--ink-soft)" }}>
        {left.timeSec !== null && right.timeSec !== null
          ? verdictText(left.timeSec, right.timeSec, left.subject, right.subject)
          : forfeit
            ? `${who(leftWon ? right.label : left.label)} 중간에 나갔어요`
            : `${who(leftWon ? left.label : right.label)} 먼저 다 풀었어요`}
      </p>
    </div>
  );
}
