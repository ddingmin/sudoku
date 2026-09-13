import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatTime } from "@/lib/encode";
import { decodeDuel, gapText, judge } from "@/lib/duel";
import { DIFFICULTY_LABEL, dailyNumber } from "@/lib/sudoku";
import ShareCard, { Emblem } from "@/components/ShareCard";
import ShareRecap from "@/components/ShareRecap";
import DuelResultCard from "@/components/DuelResultCard";

interface Props {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const d = decodeDuel(code);
  if (!d) return { title: "스도쿠" };
  const id = `${d.record.daily ? `#${dailyNumber(d.record.dateKey)} ` : ""}${DIFFICULTY_LABEL[d.record.difficulty]}`;
  const title = d.opponent
    ? `스도쿠 ${id} 대결 결과 · ${formatTime(d.record.timeSec)} vs ${formatTime(d.opponent.timeSec)}`
    : `스도쿠 ${id} · 1:1 대결 신청 ${formatTime(d.record.timeSec)}`;
  const outcome = d.opponent ? judge(d.record.timeSec, d.opponent.timeSec) : null;
  const description = d.opponent
    ? `${outcome === "tie" ? "동점" : `${gapText(d.record.timeSec, d.opponent.timeSec)}로 ${outcome === "win" ? "답장" : "도전장"} 승`} · 같은 문제로 도전 가능`
    : `같은 문제로 1:1 대결. 상대 기록 ${formatTime(d.record.timeSec)} · 실수 ${d.record.mistakes} · 힌트 ${d.record.hints}`;
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function DuelPage({ params }: Props) {
  const { code } = await params;
  const d = decodeDuel(code);
  if (!d) notFound();
  const { record, opponent } = d;
  const acceptHref = `/#duel=${code}`;

  return (
    <main
      data-difficulty={record.difficulty}
      className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-6 overflow-hidden px-5 py-10"
    >
      <div className="flex items-center gap-2.5">
        <Emblem size={26} />
        <p className="font-display text-xl leading-none">스도쿠</p>
      </div>

      {opponent ? (
        <>
          {/* 답장: 결과 */}
          <div className="flex flex-col items-center gap-1.5">
            <h1 className="font-display text-center text-[2.1rem] leading-[1.25]">
              대결
              <br />
              <span className="swipe">
                <span>결과</span>
              </span>
            </h1>
            <p className="text-[0.82rem] font-bold" style={{ color: "var(--ink-faint)" }}>
              1:1 고스트 대결
            </p>
          </div>
          <DuelResultCard
            record={record}
            left={{ label: "도전장", timeSec: opponent.timeSec, mistakes: opponent.mistakes, hints: opponent.hints }}
            right={{ label: "답장", timeSec: record.timeSec, mistakes: record.mistakes, hints: record.hints }}
          />
        </>
      ) : (
        <>
          {/* 도전장 */}
          <div className="flex flex-col items-center gap-1.5">
            <h1 className="font-display text-center text-[2.1rem] leading-[1.25]">
              같은 문제로
              <br />
              <span className="swipe">
                <span>붙어볼래?</span>
              </span>
            </h1>
            <p className="text-[0.82rem] font-bold" style={{ color: "var(--ink-faint)" }}>
              1:1 고스트 대결
            </p>
          </div>
          <ShareCard record={record} />
        </>
      )}

      {record.moves && record.seed !== undefined && <ShareRecap record={record} />}

      {/* 규칙 */}
      <ul className="flex w-full flex-col gap-1.5 px-1 text-[0.74rem] font-bold" style={{ color: "var(--ink-soft)" }}>
        {[
          "상대가 채운 칸은 점으로만 표시, 숫자는 비공개",
          "클리어 시간이 빠른 쪽이 승리",
          "결과는 답장 링크로 회신, 진행 상태는 자동 저장",
        ].map((line) => (
          <li key={line} className="flex items-start gap-2">
            <span className="checker mt-1 h-2 w-2 shrink-0" />
            {line}
          </li>
        ))}
      </ul>

      <div className="flex w-full flex-col items-center gap-2.5">
        {/* 해시 진입(/#duel=…)은 전체 내비게이션으로 — 클라이언트 전환은 홈 마운트 시점에 해시가 아직 없다 */}
        <a
          href={acceptHref}
          className="chunky chunky-press flex w-full items-center justify-center gap-2 py-4 text-[1rem] font-extrabold"
          style={{ background: "var(--primary)", color: "var(--on-primary)", boxShadow: "var(--shadow-lg)" }}
        >
          {opponent ? "이 기록에 도전하기" : "도전 받기"}
          <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </a>
        {opponent ? (
          <a href={`/#free=${record.difficulty}`} className="text-[0.78rem] font-bold underline underline-offset-4" style={{ color: "var(--ink-faint)" }}>
            새 문제로 대결
          </a>
        ) : (
          <Link href="/" className="text-[0.78rem] font-bold underline underline-offset-4" style={{ color: "var(--ink-faint)" }}>
            홈으로
          </Link>
        )}
      </div>

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
