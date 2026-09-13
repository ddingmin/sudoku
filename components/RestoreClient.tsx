"use client";

// 기록 불러오기: /restore#<code> 의 해시를 읽어 미리보기 후 이 기기의 기록에 합친다
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BackupData, decodeBackup } from "@/lib/backup";
import { clearedDayCount, loadStats, mergeStats, streakInfo } from "@/lib/stats";
import { DIFFICULTIES, DIFFICULTY_LABEL } from "@/lib/sudoku";
import { formatTime } from "@/lib/encode";
import GrassGrid from "./GrassGrid";
import { Emblem } from "./ShareCard";

type Phase = "loading" | "invalid" | "preview" | "done";

export default function RestoreClient() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [data, setData] = useState<BackupData | null>(null);
  const [localDays, setLocalDays] = useState(0);

  useEffect(() => {
    const code = location.hash.slice(1);
    const decoded = code ? decodeBackup(code) : null;
    if (!decoded) {
      setPhase("invalid");
      return;
    }
    setData(decoded);
    setLocalDays(clearedDayCount(loadStats()));
    setPhase("preview");
  }, []);

  const restore = () => {
    if (!data) return;
    mergeStats(data);
    setPhase("done");
    setTimeout(() => router.push("/"), 1400);
  };

  const card = "flex w-full flex-col gap-4 p-5";
  const cardStyle = { background: "var(--surface)", border: "2px solid var(--edge)", borderRadius: "var(--r-lg)", boxShadow: "var(--shadow-md)" };

  return (
    <main
      data-difficulty="normal"
      className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-6 px-5 py-10"
    >
      <div className="flex items-center gap-2.5">
        <Emblem size={26} />
        <p className="font-display text-xl leading-none">스도쿠</p>
      </div>

      {phase === "invalid" && (
        <>
          <h1 className="font-display text-center text-[1.8rem] leading-[1.25]">
            기록을 읽을 수
            <br />
            없어요
          </h1>
          <p className="text-center text-[0.82rem] font-bold" style={{ color: "var(--ink-faint)" }}>
            링크가 잘렸거나 오래된 형식입니다.
            <br />
            기록 화면에서 링크를 다시 만들어 주세요.
          </p>
          <Link href="/" className="chunky chunky-press w-full py-4 text-center text-[1rem] font-extrabold" style={{ boxShadow: "var(--shadow-lg)" }}>
            홈으로
          </Link>
        </>
      )}

      {(phase === "preview" || phase === "done") && data && (
        <>
          <div className="flex flex-col items-center gap-1.5">
            <h1 className="font-display text-center text-[1.8rem] leading-[1.25]">
              {phase === "done" ? "기록을 합쳤어요" : "이 기록을 불러올까요?"}
            </h1>
            <p className="text-[0.82rem] font-bold" style={{ color: "var(--ink-faint)" }}>
              {phase === "done"
                ? "홈으로 이동합니다"
                : localDays > 0
                  ? `이 기기의 기록 ${localDays}일과 합쳐집니다`
                  : "다른 기기의 기록"}
            </p>
          </div>

          <div className={card} style={cardStyle}>
            <GrassGrid days={data.days} minWeeks={16} />
            <div className="grid grid-cols-3 gap-2">
              {[
                ["클리어한 날", `${Object.keys(data.days).length}일`],
                ["최장 연속", `${streakInfo(data.days).max}일`],
                ["클리어", `${data.cleared}판`],
              ].map(([label, value]) => (
                <div key={label} className="flex flex-col items-center gap-1 py-2" style={{ background: "var(--ground)", border: "2px solid var(--edge)", borderRadius: "var(--r-sm)" }}>
                  <span className="text-[0.6rem] font-extrabold" style={{ color: "var(--ink-faint)" }}>
                    {label}
                  </span>
                  <span className="font-display tabular text-[1rem] leading-none">{value}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[0.72rem] font-bold" style={{ color: "var(--ink-soft)" }}>
              {DIFFICULTIES.filter((d) => data.bests[d] !== undefined).map((d) => (
                <span key={d}>
                  {DIFFICULTY_LABEL[d]} 베스트 <span className="tabular" style={{ color: "var(--primary)" }}>{formatTime(data.bests[d]!)}</span>
                </span>
              ))}
            </div>
          </div>

          <button
            onClick={restore}
            disabled={phase === "done"}
            className="chunky chunky-press w-full py-4 text-[1rem] font-extrabold disabled:opacity-60"
            style={{ background: "var(--primary)", color: "var(--on-primary)", boxShadow: "var(--shadow-lg)" }}
          >
            {phase === "done" ? "완료" : "이 기기에 불러오기"}
          </button>
          {phase === "preview" && (
            <Link href="/" className="text-[0.78rem] font-bold underline" style={{ color: "var(--ink-faint)" }}>
              홈으로
            </Link>
          )}
        </>
      )}
    </main>
  );
}
