import type { Metadata } from "next";
import Link from "next/link";
import { readRoom, toView } from "@/lib/roomServer";
import { ResultCode, encodeResult, resultFromView } from "@/lib/room";
import { DIFFICULTY_LABEL, todayKey } from "@/lib/sudoku";
import { Emblem } from "@/components/ShareCard";
import DuelResultCard from "@/components/DuelResultCard";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

async function load(id: string) {
  const now = Date.now();
  const rec = await readRoom(id.toUpperCase(), now);
  if (!rec) return null;
  // 끝난 방은 결과를 바로 보여준다
  const result: ResultCode | null = rec.status === "finished" ? resultFromView(toView(rec, "host", now)) : null;
  return { status: rec.status, difficulty: rec.difficulty, hasGuest: !!rec.guest, result };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const r = await load(id);
  const title = r ? `스도쿠 실시간 대결 · ${DIFFICULTY_LABEL[r.difficulty]}` : "스도쿠 실시간 대결";
  const description = !r
    ? "끝났거나 없는 대결이에요"
    : r.status === "waiting"
      ? "친구가 기다리고 있어요. 링크를 열면 같은 문제로 바로 시작돼요."
      : r.status === "finished"
        ? "끝난 대결이에요. 결과를 볼 수 있어요."
        : r.status === "abandoned"
          ? "끝난 대결이에요"
          : "이미 시작된 대결이에요";
  return { title, description, openGraph: { title, description }, twitter: { card: "summary_large_image", title, description }, robots: { index: false } };
}

export default async function RoomPage({ params }: Props) {
  const { id } = await params;
  const r = await load(id);
  const code = id.toUpperCase();
  const joinable = r && r.status === "waiting";
  const finished = r && r.status === "finished" && r.result;
  const rejoinable = r && !finished && (r.status === "countdown" || r.status === "playing" || r.status === "finished");

  return (
    <main
      data-difficulty={r?.difficulty ?? "normal"}
      className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-6 overflow-hidden px-5 py-10"
    >
      <div className="flex items-center gap-2.5">
        <Emblem size={26} />
        <p className="font-display text-xl leading-none">스도쿠</p>
      </div>

      <div className="flex flex-col items-center gap-1.5">
        <h1 className="font-display text-center text-[2.1rem] leading-[1.25]">
          {joinable ? (
            <>
              같은 문제로
              <br />
              <span className="swipe">
                <span>지금 붙어볼래?</span>
              </span>
            </>
          ) : finished ? (
            <>
              실시간 대결
              <br />
              <span className="swipe">
                <span>결과</span>
              </span>
            </>
          ) : rejoinable ? (
            <>
              이미 시작된
              <br />
              대결이에요
            </>
          ) : (
            <>
              끝났거나
              <br />
              없는 대결이에요
            </>
          )}
        </h1>
        <p className="text-[0.82rem] font-bold" style={{ color: "var(--ink-faint)" }}>
          {joinable ? "친구가 기다리고 있어요" : finished ? "같은 문제를 같은 순간에 풀었어요" : rejoinable ? "참가자라면 이어서 들어갈 수 있어요" : "친구에게 새 링크를 받아 주세요"}
        </p>
      </div>

      {finished && r.result && (
        <DuelResultCard
          record={{ daily: false, dateKey: todayKey(), difficulty: r.difficulty }}
          left={{ label: "방장", subject: "방장 기록이", timeSec: r.result.host.timeSec, mistakes: r.result.host.mistakes, hints: r.result.host.hints }}
          right={{ label: "도전자", subject: "도전자 기록이", timeSec: r.result.guest.timeSec, mistakes: r.result.guest.mistakes, hints: r.result.guest.hints }}
          leftWon={r.result.winner === "host"}
          forfeit={r.result.forfeit}
          title={`실시간 대결 · ${DIFFICULTY_LABEL[r.difficulty]}`}
        />
      )}

      {r && !finished && (
        <div
          className="flex w-full items-center justify-between p-5"
          style={{ background: "var(--surface)", border: "2.5px solid var(--edge)", borderRadius: "var(--r-xl)", boxShadow: "var(--shadow-xl)" }}
        >
          <div>
            <p className="text-[0.66rem] font-extrabold tracking-widest" style={{ color: "var(--ink-faint)" }}>
              실시간 대결
            </p>
            <p className="font-display mt-1 text-[1.6rem] leading-none" style={{ color: "var(--primary)" }}>
              {DIFFICULTY_LABEL[r.difficulty]}
            </p>
          </div>
          <span className="sticker rotate-6" style={{ background: "var(--pop)", color: "var(--on-pop)" }}>
            방 {code}
          </span>
        </div>
      )}

      {joinable && (
        <ul className="flex w-full flex-col gap-1.5 px-1 text-[0.74rem] font-bold" style={{ color: "var(--ink-soft)" }}>
          {["둘이 같은 순간에 같은 문제를 시작해요.", "친구가 채운 칸이 점으로 보여요. 숫자는 보이지 않아요.", "먼저 다 푸는 쪽이 이겨요. 힌트는 쓸 수 없어요."].map((line) => (
            <li key={line} className="flex items-start gap-2">
              <span className="checker mt-1 h-2 w-2 shrink-0" />
              {line}
            </li>
          ))}
        </ul>
      )}

      <div className="flex w-full flex-col items-center gap-2.5">
        {joinable || rejoinable ? (
          // 해시 진입(/#room=…)은 전체 내비게이션으로 — 홈 마운트 시점에 해시가 있어야 한다
          <a
            href={`/#room=${code}`}
            className="chunky chunky-press flex w-full items-center justify-center gap-2 py-4 text-[1rem] font-extrabold"
            style={{ background: "var(--primary)", color: "var(--on-primary)", boxShadow: "var(--shadow-lg)" }}
          >
            {joinable ? "참가하기" : "대결로 들어가기"}
            <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </a>
        ) : (
          <a
            href="/#lobby"
            className="chunky chunky-press flex w-full items-center justify-center gap-2 py-4 text-[1rem] font-extrabold"
            style={{ background: "var(--primary)", color: "var(--on-primary)", boxShadow: "var(--shadow-lg)" }}
          >
            {finished ? "나도 친구와 대결하기" : "내가 방 만들기"}
          </a>
        )}
        {finished && r.result && (
          <Link href={`/result/${encodeResult(r.result)}`} className="text-[0.78rem] font-bold underline underline-offset-4" style={{ color: "var(--ink-faint)" }}>
            결과 링크 열기
          </Link>
        )}
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
