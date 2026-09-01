import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { decodeRecord, formatTime } from "@/lib/encode";
import { DIFFICULTY_LABEL, dailyNumber } from "@/lib/sudoku";
import ShareCard, { Emblem } from "@/components/ShareCard";
import ShareRecap from "@/components/ShareRecap";

interface Props {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const record = decodeRecord(code);
  if (!record) return { title: "스도쿠" };
  const title = record.daily
    ? `스도쿠 #${dailyNumber(record.dateKey)} · ${DIFFICULTY_LABEL[record.difficulty]} ${formatTime(record.timeSec)}`
    : `스도쿠 · ${DIFFICULTY_LABEL[record.difficulty]} ${formatTime(record.timeSec)}`;
  const description = `실수 ${record.mistakes} · 힌트 ${record.hints}${record.streak > 1 ? ` · ${record.streak}일 연속` : ""} — 이 기록, 깰 수 있어? 매일 한 판, 스도쿠.`;
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function SharePage({ params }: Props) {
  const { code } = await params;
  const record = decodeRecord(code);
  if (!record) notFound();

  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-6 overflow-hidden px-5 py-10">
      {/* 로고 */}
      <div className="flex items-center gap-2.5">
        <Emblem size={26} />
        <p className="font-display text-xl leading-none">스도쿠</p>
      </div>

      {/* 도발 헤드라인 */}
      <div className="flex flex-col items-center gap-1.5">
        <h1 className="font-display text-center text-[2.1rem] leading-[1.25]">
          이 기록,
          <br />
          <span className="swipe">
            <span>깰 수 있어?</span>
          </span>
        </h1>
        <p className="text-[0.82rem] font-bold" style={{ color: "var(--ink-faint)" }}>
          친구가 오늘의 스도쿠를 이렇게 깼어요
        </p>
      </div>

      {record.moves && record.seed !== undefined && <ShareRecap record={record} />}

      <ShareCard record={record} />

      {/* CTA */}
      <div className="flex w-full flex-col items-center gap-2.5">
        <Link
          href="/"
          className="chunky chunky-press flex w-full items-center justify-center gap-2 py-4 text-[1rem] font-extrabold"
          style={{ background: "var(--primary)", color: "var(--on-primary)", boxShadow: "var(--shadow-lg)" }}
        >
          나도 풀어보기
          <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </Link>
      </div>

      {/* 하단 체커 스트립 */}
      <div
        className="absolute inset-x-0 bottom-0 h-5"
        style={{
          background: "repeating-conic-gradient(var(--ink) 0% 25%, transparent 0% 50%)",
          backgroundSize: "20px 20px",
          opacity: 0.9,
        }}
      />
    </main>
  );
}
