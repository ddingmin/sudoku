"use client";

// 잔디: 날짜별 데일리 클리어를 주 단위 격자로. 진하기 = 그날 클리어한 난이도 수
import { useEffect, useRef } from "react";
import { DIFFICULTIES, DIFFICULTY_LABEL, dailyNumber, dailyKeyFromNumber, todayKey } from "@/lib/sudoku";
import { DayClears } from "@/lib/stats";
import { formatTime } from "@/lib/encode";

interface GrassGridProps {
  days: Record<string, DayClears>;
  minWeeks?: number; // 기록이 짧아도 최소 이만큼의 주를 그린다
}

const CELL = 12;
const GAP = 3;
const LEVEL_ALPHA = ["", "45%", "65%", "85%", "100%"];

function dayLabel(dateKey: string, day: DayClears | undefined): string {
  const date = dateKey.replace(/-/g, ".");
  if (!day) return `${date} · 미클리어`;
  const parts = DIFFICULTIES.filter((d) => day[d] !== undefined).map((d) =>
    day[d]! > 0 ? `${DIFFICULTY_LABEL[d]} ${formatTime(day[d]!)}` : DIFFICULTY_LABEL[d],
  );
  return `${date} · ${parts.join(", ")}`;
}

export default function GrassGrid({ days, minWeeks = 20 }: GrassGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const today = todayKey();
  const todayNum = dailyNumber(today);
  const nums = Object.keys(days).map(dailyNumber);
  const earliest = nums.length ? Math.min(...nums, todayNum) : todayNum;
  // 격자는 월요일 시작. 오늘 열이 마지막이 되도록 뒤에서부터 채운다
  const todayDow = (new Date(today + "T00:00:00Z").getUTCDay() + 6) % 7; // 0 = 월
  const lastColStart = todayNum - todayDow;
  const weeks = Math.max(minWeeks, Math.ceil((lastColStart - earliest) / 7) + 1);
  const firstNum = lastColStart - (weeks - 1) * 7;

  // 처음 열릴 때 오늘(오른쪽 끝)이 보이도록
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [weeks]);

  const columns: number[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col: number[] = [];
    for (let d = 0; d < 7; d++) col.push(firstNum + w * 7 + d);
    columns.push(col);
  }

  // 월 라벨: 그 주에 1일이 포함된 열 위에
  const monthLabel = (col: number[]) => {
    for (const n of col) {
      const key = dailyKeyFromNumber(n);
      if (key.endsWith("-01") && n <= todayNum) return `${Number(key.slice(5, 7))}월`;
    }
    return null;
  };

  return (
    <div ref={scrollRef} className="overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }} aria-label="날짜별 클리어 기록">
      {/* 오른쪽 여백: 마지막 열의 월 라벨이 넘쳐 스크롤이 생기지 않게 */}
      <div className="flex flex-col gap-1" style={{ width: weeks * (CELL + GAP) - GAP, paddingRight: 14 }}>
        <div className="flex text-[0.58rem] font-extrabold" style={{ gap: GAP, height: 12, color: "var(--ink-faint)" }}>
          {columns.map((col, i) => (
            <span key={i} className="shrink-0 leading-none whitespace-nowrap" style={{ width: CELL }}>
              {monthLabel(col) ?? ""}
            </span>
          ))}
        </div>
        <div className="flex" style={{ gap: GAP }}>
          {columns.map((col, ci) => (
            <div key={ci} className="flex flex-col" style={{ gap: GAP }}>
              {col.map((n) => {
                const key = dailyKeyFromNumber(n);
                const future = n > todayNum;
                const day = days[key];
                const level = day ? Math.max(1, DIFFICULTIES.filter((d) => day[d] !== undefined).length) : 0;
                const isToday = n === todayNum;
                return (
                  <span
                    key={n}
                    title={future ? undefined : dayLabel(key, day)}
                    className="block shrink-0"
                    style={{
                      width: CELL,
                      height: CELL,
                      borderRadius: 3,
                      background: future
                        ? "transparent"
                        : level > 0
                          ? `color-mix(in srgb, var(--primary) ${LEVEL_ALPHA[level]}, var(--surface))`
                          : "color-mix(in srgb, var(--ink) 8%, var(--surface))",
                      outline: isToday ? "2px solid var(--ink)" : undefined,
                      outlineOffset: -1,
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
