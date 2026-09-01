// 공유용 기록 카드 — WinModal / 공유 랜딩 페이지 공용 (서버 렌더 가능)
import { ShareRecord, formatTime } from "@/lib/encode";
import { DIFFICULTY_LABEL, dailyNumber } from "@/lib/sudoku";

// 체커 사각 엠블럼 — 브랜드 모티프
export function Emblem({ size = 26 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="checker inline-block"
      style={{
        width: size,
        height: size,
        backgroundSize: `${size / 2}px ${size / 2}px`,
        border: "2px solid var(--edge)",
        borderRadius: 7,
      }}
    />
  );
}

export default function ShareCard({ record }: { record: ShareRecord }) {
  return (
    <div
      className="relative w-full p-6"
      style={{
        background: "var(--surface)",
        border: "2.5px solid var(--edge)",
        borderRadius: "var(--r-xl)",
        boxShadow: "var(--shadow-xl)",
      }}
    >
      {/* 스티커: 신기록 */}
      {record.best && (
        <span
          className="sticker absolute -top-3.5 -right-2 rotate-6"
          style={{ background: "var(--danger)", color: "#ffffff", fontSize: "0.72rem", padding: "7px 11px" }}
        >
          신기록!
        </span>
      )}
      {/* 스티커: 스트릭 */}
      {record.streak > 1 && (
        <span
          className="sticker absolute top-[52%] -left-4 -rotate-8"
          style={{ background: "var(--pop)", color: "var(--on-pop)", fontSize: "0.72rem", padding: "7px 11px" }}
        >
          {record.streak}일 연속
        </span>
      )}

      {/* 카드 헤더 */}
      <div className="flex items-center justify-between">
        <span className="font-display text-xl leading-none">스도쿠</span>
        <span className="text-[0.68rem] font-bold" style={{ color: "var(--ink-faint)" }}>
          {record.daily ? `#${dailyNumber(record.dateKey)} · ` : "자유 스도쿠 · "}
          {record.dateKey.replace(/-/g, ".")}
        </span>
      </div>

      {/* 클리어 타임 */}
      <div className="mt-5 flex flex-col items-center gap-1">
        <p className="text-[0.68rem] font-extrabold tracking-[0.25em]" style={{ color: "var(--ink-faint)" }}>
          클리어 타임
        </p>
        <span className="swipe">
          <span className="font-display tabular text-[3.6rem] leading-[1.05]" style={{ color: "var(--primary)" }}>
            {formatTime(record.timeSec)}
          </span>
        </span>
      </div>

      {/* 스탯 칩 */}
      <div className="mt-5 grid grid-cols-3 gap-2">
        {(
          [
            ["난이도", DIFFICULTY_LABEL[record.difficulty]],
            ["실수", `${record.mistakes}`],
            ["힌트", `${record.hints}`],
          ] as Array<[string, string]>
        ).map(([label, value]) => (
          <div
            key={label}
            className="flex flex-col items-center gap-1 py-2.5"
            style={{ background: "var(--ground)", border: "2px solid var(--edge)", borderRadius: "var(--r-sm)" }}
          >
            <span className="text-[0.62rem] font-extrabold" style={{ color: "var(--ink-faint)" }}>
              {label}
            </span>
            <span className="tabular text-[0.95rem] font-extrabold leading-none">{value}</span>
          </div>
        ))}
      </div>

      {/* 카드 푸터 */}
      <div className="mt-4 flex items-center justify-center gap-2 border-t-2 border-dashed pt-3.5" style={{ borderColor: "var(--cell-line)" }}>
        <span className="checker h-2 w-9" />
        <span className="text-[0.62rem] font-extrabold" style={{ color: "var(--ink-faint)" }}>
          매일 한 판 · 스도쿠
        </span>
        <span className="checker h-2 w-9" />
      </div>
    </div>
  );
}
