import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatTime } from "@/lib/encode";
import { decodeResult } from "@/lib/room";
import { verdictText } from "@/lib/duelText";
import { DIFFICULTY_LABEL, todayKey } from "@/lib/sudoku";
import DuelResultCard from "@/components/DuelResultCard";
import { Emblem } from "@/components/ShareCard";

interface Props {
  params: Promise<{ code: string }>;
}

function summary(code: string) {
  const r = decodeResult(code);
  if (!r) return null;
  const a = r.host.timeSec;
  const b = r.guest.timeSec;
  const line =
    a !== null && b !== null
      ? verdictText(a, b, "방장 기록이", "도전자 기록이")
      : r.forfeit
        ? `${r.winner === "host" ? "도전자" : "방장"}가 중간에 나갔어요`
        : `${r.winner === "host" ? "방장" : "도전자"}이 먼저 다 풀었어요`;
  return { r, line, a, b };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const s = summary(code);
  if (!s) return { title: "스도쿠" };
  const title = `스도쿠 실시간 대결 · ${DIFFICULTY_LABEL[s.r.difficulty]}${s.a !== null && s.b !== null ? ` · ${formatTime(s.a)} vs ${formatTime(s.b)}` : ""}`;
  return { title, description: s.line, openGraph: { title, description: s.line }, twitter: { card: "summary_large_image", title, description: s.line } };
}

export default async function ResultPage({ params }: Props) {
  const { code } = await params;
  const s = summary(code);
  if (!s) notFound();
  const { r } = s;

  return (
    <main
      data-difficulty={r.difficulty}
      className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-6 overflow-hidden px-5 py-10"
    >
      <div className="flex items-center gap-2.5">
        <Emblem size={26} />
        <p className="font-display text-xl leading-none">스도쿠</p>
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <h1 className="font-display text-center text-[2.1rem] leading-[1.25]">
          실시간 대결
          <br />
          <span className="swipe">
            <span>결과</span>
          </span>
        </h1>
        <p className="text-[0.82rem] font-bold" style={{ color: "var(--ink-faint)" }}>
          같은 문제를 같은 순간에 풀었어요
        </p>
      </div>

      <DuelResultCard
        record={{ daily: false, dateKey: todayKey(), difficulty: r.difficulty }}
        left={{ label: "방장", subject: "방장 기록이", timeSec: r.host.timeSec, mistakes: r.host.mistakes, hints: r.host.hints }}
        right={{ label: "도전자", subject: "도전자 기록이", timeSec: r.guest.timeSec, mistakes: r.guest.mistakes, hints: r.guest.hints }}
        leftWon={r.winner === "host"}
        forfeit={r.forfeit}
        title={`실시간 대결 · ${DIFFICULTY_LABEL[r.difficulty]}`}
      />

      <div className="flex w-full flex-col items-center gap-2.5">
        <a
          href="/#lobby"
          className="chunky chunky-press flex w-full items-center justify-center gap-2 py-4 text-[1rem] font-extrabold"
          style={{ background: "var(--primary)", color: "var(--on-primary)", boxShadow: "var(--shadow-lg)" }}
        >
          나도 친구와 대결하기
          <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </a>
        <Link href="/" className="text-[0.78rem] font-bold underline underline-offset-4" style={{ color: "var(--ink-faint)" }}>
          홈으로
        </Link>
      </div>

      <div
        className="absolute inset-x-0 bottom-0 h-5"
        style={{ background: "repeating-conic-gradient(var(--ink) 0% 25%, transparent 0% 50%)", backgroundSize: "20px 20px", opacity: 0.9 }}
      />
    </main>
  );
}
