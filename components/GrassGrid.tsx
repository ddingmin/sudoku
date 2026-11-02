"use client";

// 잔디: 날짜별 데일리 클리어를 주 단위 격자로. 진하기 = 그날 클리어한 난이도 수
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { DIFFICULTIES, DIFFICULTY_LABEL, dailyNumber, dailyKeyFromNumber, todayKey } from "@/lib/sudoku";
import { DayClears } from "@/lib/stats";
import { formatTime } from "@/lib/encode";

interface GrassGridProps {
  days: Record<string, DayClears>;
  minWeeks?: number; // 기록이 짧아도 최소 이만큼의 주를 그린다
}

const MIN_CELL = 10;
const RIGHT = 10;
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
  const [width, setWidth] = useState(0); // 컨테이너 폭
  const today = todayKey();
  const todayNum = dailyNumber(today);
  const nums = Object.keys(days).map(dailyNumber);
  const earliest = nums.length ? Math.min(...nums, todayNum) : todayNum;
  // 격자는 월요일 시작. 오늘 열이 마지막이 되도록 뒤에서부터 채운다
  const todayDow = (new Date(today + "T00:00:00Z").getUTCDay() + 6) % 7; // 0 = 월
  const lastColStart = todayNum - todayDow;
  const weeks = Math.max(minWeeks, Math.ceil((lastColStart - earliest) / 7) + 1);
  const firstNum = lastColStart - (weeks - 1) * 7;

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 칸은 정사각형. 컨테이너를 꽉 채우도록 1fr 열을 쓰되, 최소 칸 크기보다 작아지면 고정 크기 + 가로 스크롤.
  // 오른쪽 RIGHT는 마지막 열의 월 라벨이 넘치는 몫
  const fit = width > 0 ? (width - RIGHT - (weeks - 1) * GAP) / weeks : MIN_CELL;
  const scrolling = fit < MIN_CELL;
  const step = MIN_CELL + GAP;
  // 스크롤일 땐 스크롤 끝이 열 경계에 맞도록 여백을 늘려(첫 열이 반쯤 잘려 월 라벨이 깨지지 않게)
  const over = scrolling ? ((((weeks * step - GAP + RIGHT - width) % step) + step) % step) : 0;
  const pad = RIGHT + (over === 0 ? 0 : step - over);
  const cols = scrolling ? `repeat(${weeks}, ${MIN_CELL}px)` : `repeat(${weeks}, minmax(0, 1fr))`;

  // 처음 열릴 때 오늘(오른쪽 끝)이 보이도록
  useEffect(() => {
    const el = scrollRef.current;
    if (el && scrolling) el.scrollLeft = el.scrollWidth;
  }, [weeks, pad, scrolling]);

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
      <div className="flex flex-col gap-1" style={scrolling ? { width: weeks * step - GAP, paddingRight: pad, boxSizing: "content-box" } : { paddingRight: RIGHT }}>
        <div className="grid text-[0.69rem] font-extrabold" style={{ gridTemplateColumns: cols, columnGap: GAP, height: 14, color: "var(--ink-soft)" }}>
          {columns.map((col, i) => (
            <span key={i} className="leading-none whitespace-nowrap">
              {monthLabel(col) ?? ""}
            </span>
          ))}
        </div>
        <div className="grid" style={{ gridTemplateColumns: cols, columnGap: GAP }}>
          {columns.map((col, ci) => (
            <div key={ci} className="flex min-w-0 flex-col" style={{ gap: GAP }}>
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
                    className="block w-full"
                    style={{
                      aspectRatio: "1",
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
