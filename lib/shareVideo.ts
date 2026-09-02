"use client";

// 릴스/스토리용 리캡 영상 (1080x1920, ~7.4초)
// 1순위: WebCodecs + mp4-muxer → H.264 MP4 (인스타그램 호환, 오프라인 고속 인코딩)
// 2순위: canvas.captureStream + MediaRecorder (실시간 녹화, mp4 또는 webm)
import { Muxer, ArrayBufferTarget } from "mp4-muxer";
import { Move, ShareRecord, formatTime } from "./encode";
import { DIFFICULTY_LABEL, dailyNumber, generatePuzzle } from "./sudoku";
import { DIFF_THEME, DiffTheme } from "./palette";

const C = {
  surface: "#ffffff",
  ground: "#faf8f3",
  ink: "#141414",
  inkFaint: "#9b978c",
  pop: "#c8f04d",
  danger: "#e93a5e",
  peer: "#eef2ff",
};

const DISPLAY = '"Bagel Fat One", "Pretendard Variable", sans-serif';
const SANS = '"Pretendard Variable", Pretendard, sans-serif';

const W = 1080;
const H = 1920;
const FPS = 30;
const INTRO = 0.6; // 타이틀 팝인
const REPLAY = 4.6; // 타임랩스 구간
const OUTRO = 2.6; // 엔드 카드 (결과 시간을 충분히 보여줌)
const TOTAL = INTRO + REPLAY + OUTRO;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function chunkyRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string, offset: number, border = 6) {
  if (offset > 0) {
    ctx.fillStyle = C.ink;
    roundRect(ctx, x + offset, y + offset, w, h, r);
    ctx.fill();
  }
  ctx.fillStyle = fill;
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = border;
  roundRect(ctx, x, y, w, h, r);
  ctx.stroke();
}

function checker(ctx: CanvasRenderingContext2D, y: number, height: number, cell: number, color: string) {
  ctx.fillStyle = color;
  for (let cy = 0; cy * cell < height; cy++) {
    for (let cx = 0; cx * cell < W; cx++) {
      if ((cx + cy) % 2 === 0) ctx.fillRect(cx * cell, y + cy * cell, cell, cell);
    }
  }
}

// 오버슈트 스프링 팝 (0→1)
function pop(p: number): number {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  return 1 + Math.pow(2, -8 * p) * Math.sin((p * 10 - 0.75) * ((2 * Math.PI) / 3));
}

interface FrameData {
  record: ShareRecord;
  theme: DiffTheme;
  puzzle: number[];
  solution: number[];
  moves: Move[];
  moveAt: number[]; // 각 무브가 등장하는 시각(초)
}

function prepare(record: ShareRecord): FrameData {
  const { puzzle, solution } = generatePuzzle(record.difficulty, record.seed!);
  const moves = record.moves!;
  const n = moves.length;
  const moveAt = moves.map((_, i) => INTRO + (n <= 1 ? 0 : (i / (n - 1)) * (REPLAY - 0.3)));
  return { record, theme: DIFF_THEME[record.difficulty], puzzle, solution, moves, moveAt };
}

function renderFrame(ctx: CanvasRenderingContext2D, t: number, d: FrameData) {
  const { record, theme, puzzle, solution, moves, moveAt } = d;

  // 바탕
  ctx.fillStyle = theme.primary;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 0.5;
  checker(ctx, 0, 120, 60, theme.strong);
  checker(ctx, H - 120, 120, 60, theme.strong);
  ctx.globalAlpha = 1;

  // 타이틀
  const titleP = pop(Math.min(1, t / INTRO));
  if (titleP > 0) {
    ctx.save();
    ctx.translate(W / 2, 250);
    ctx.rotate(-0.035);
    ctx.scale(titleP, titleP);
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.font = `400 150px ${DISPLAY}`;
    ctx.fillStyle = C.ink;
    ctx.fillText("클리어!", 10, 10);
    ctx.fillStyle = C.surface;
    ctx.fillText("클리어!", 0, 0);
    ctx.restore();
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = `700 40px ${SANS}`;
  const sub = record.daily ? `오늘의 스도쿠 #${dailyNumber(record.dateKey)} · ${DIFFICULTY_LABEL[record.difficulty]}` : `자유 스도쿠 · ${DIFFICULTY_LABEL[record.difficulty]}`;
  ctx.fillText(sub, W / 2, 350);

  // 보드 카드
  const bs = 900;
  const bx = (W - bs) / 2;
  const by = 430;
  chunkyRect(ctx, bx, by, bs, bs, 40, C.surface, 14, 7);
  const cell = bs / 9;

  // 모서리 셀이 라운드를 침범하지 않도록 카드 내부로 클리핑
  ctx.save();
  roundRect(ctx, bx + 3, by + 3, bs - 6, bs - 6, 34);
  ctx.clip();

  // 현재 시점의 셀 상태
  const state = new Array<number>(81).fill(0); // 0 없음 1 정답 2 힌트 3 오답
  const appearP = new Array<number>(81).fill(1);
  for (let m = 0; m < moves.length; m++) {
    if (t < moveAt[m]) break;
    const { i, k } = moves[m];
    state[i] = k === 0 ? 1 : k === 2 ? 2 : 3;
    appearP[i] = Math.min(1, (t - moveAt[m]) / 0.2);
  }

  for (let i = 0; i < 81; i++) {
    const r = Math.floor(i / 9);
    const c = i % 9;
    const x = bx + c * cell;
    const y = by + r * cell;
    const cxm = x + cell / 2;
    const cym = y + cell / 2;

    if (puzzle[i] > 0) {
      ctx.fillStyle = C.ink;
      ctx.font = `800 54px ${SANS}`;
      ctx.textBaseline = "middle";
      ctx.fillText(String(puzzle[i]), cxm, cym + 4);
    } else if (state[i] > 0) {
      const p = pop(appearP[i]);
      const bg = state[i] === 1 ? theme.peer : state[i] === 2 ? C.pop : "#ffdde4";
      ctx.save();
      ctx.translate(cxm, cym);
      ctx.scale(p, p);
      ctx.fillStyle = bg;
      roundRect(ctx, -cell / 2 + 7, -cell / 2 + 7, cell - 14, cell - 14, 12);
      ctx.fill();
      if (state[i] === 3) {
        ctx.strokeStyle = C.danger;
        ctx.lineWidth = 7;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(-14, -14);
        ctx.lineTo(14, 14);
        ctx.moveTo(14, -14);
        ctx.lineTo(-14, 14);
        ctx.stroke();
      } else {
        ctx.fillStyle = state[i] === 2 ? C.ink : theme.primary;
        ctx.font = `800 54px ${SANS}`;
        ctx.textBaseline = "middle";
        ctx.fillText(String(solution[i]), 0, 4);
      }
      ctx.restore();
    }
  }

  // 그리드 라인
  for (let k = 1; k < 9; k++) {
    const strong = k % 3 === 0;
    ctx.strokeStyle = strong ? C.ink : "#ece9e0";
    ctx.lineWidth = strong ? 5 : 2;
    ctx.beginPath();
    ctx.moveTo(bx + k * cell, by + 4);
    ctx.lineTo(bx + k * cell, by + bs - 4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bx + 4, by + k * cell);
    ctx.lineTo(bx + bs - 4, by + k * cell);
    ctx.stroke();
  }
  ctx.restore(); // 보드 클리핑 + 보드 안에서 바꾼 텍스트 상태 원복

  // 타이머 (리플레이 진행에 비례해 카운트업, 아웃트로부터는 최종 기록 고정)
  const replayP = Math.max(0, Math.min(1, (t - INTRO) / REPLAY));
  const inOutro = t >= INTRO + REPLAY;
  const shownSec = inOutro ? record.timeSec : Math.round(replayP * record.timeSec);
  const outroP = pop(Math.max(0, Math.min(1, (t - INTRO - REPLAY) / 0.35)));
  const timerY = 1560;
  const timeStr = formatTime(shownSec);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = `400 170px ${DISPLAY}`;
  if (outroP > 0) {
    // 라임 스와이프: 실제 시간 텍스트 폭에 맞춰 크기 결정
    const tw = ctx.measureText(formatTime(record.timeSec)).width;
    ctx.save();
    ctx.translate(W / 2, timerY);
    ctx.rotate(-0.02);
    ctx.scale(Math.max(0.001, outroP), Math.max(0.001, outroP));
    ctx.fillStyle = C.pop;
    roundRect(ctx, -tw / 2 - 36, -122, tw + 72, 158, 26);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = outroP > 0 ? theme.primary : C.surface;
  ctx.fillText(timeStr, W / 2, timerY);

  // 스탯 라인 + 엔드 카피
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = `700 40px ${SANS}`;
  ctx.fillText(`실수 ${record.mistakes} · 힌트 ${record.hints}${record.streak > 1 ? ` · ${record.streak}일 연속` : ""}`, W / 2, 1660);

  if (outroP > 0) {
    ctx.globalAlpha = Math.max(0, Math.min(1, outroP));
    ctx.fillStyle = C.pop;
    ctx.font = `800 52px ${SANS}`;
    ctx.fillText("이 기록, 깰 수 있어?", W / 2, 1755);
    ctx.globalAlpha = 1;
  }
}

async function ensureFonts() {
  try {
    await Promise.all([
      document.fonts.load(`400 170px ${DISPLAY}`),
      document.fonts.load(`800 54px ${SANS}`),
      document.fonts.ready,
    ]);
  } catch {}
}

// ── 1순위: WebCodecs + mp4-muxer ──
async function renderWithWebCodecs(d: FrameData, onProgress?: (p: number) => void): Promise<Blob | null> {
  if (typeof VideoEncoder === "undefined") return null;
  const codecs = ["avc1.640028", "avc1.4d0028", "avc1.42e028"];
  let codec: string | null = null;
  for (const c of codecs) {
    try {
      const { supported } = await VideoEncoder.isConfigSupported({ codec: c, width: W, height: H, framerate: FPS });
      if (supported) {
        codec = c;
        break;
      }
    } catch {}
  }
  if (!codec) return null;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: "avc", width: W, height: H },
    fastStart: "in-memory",
  });

  let failed: unknown = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => {
      failed = e;
    },
  });
  encoder.configure({ codec, width: W, height: H, bitrate: 9_000_000, framerate: FPS });

  const frames = Math.ceil(TOTAL * FPS);
  const usec = 1_000_000 / FPS;
  const deadline = performance.now() + 60_000; // 인코더가 멈추면 폴백으로 넘어가도록 상한
  for (let i = 0; i < frames; i++) {
    if (failed) throw failed;
    renderFrame(ctx, i / FPS, d);
    const frame = new VideoFrame(canvas, { timestamp: Math.round(i * usec), duration: Math.round(usec) });
    encoder.encode(frame, { keyFrame: i % 60 === 0 });
    frame.close();
    while (encoder.encodeQueueSize > 4) {
      if (failed) throw failed;
      if (performance.now() > deadline) throw new Error("encode timeout");
      await new Promise((r) => setTimeout(r, 4));
    }
    onProgress?.(i / frames);
  }
  await Promise.race([
    encoder.flush(),
    new Promise((_, rej) => setTimeout(() => rej(new Error("flush timeout")), 20_000)),
  ]);
  if (failed) throw failed;
  muxer.finalize();
  onProgress?.(1);
  return new Blob([muxer.target.buffer], { type: "video/mp4" });
}

// ── 2순위: MediaRecorder 실시간 녹화 ──
async function renderWithRecorder(d: FrameData, onProgress?: (p: number) => void): Promise<Blob | null> {
  if (typeof MediaRecorder === "undefined") return null;
  const mime = ["video/mp4", "video/webm;codecs=h264", "video/webm;codecs=vp9", "video/webm"].find((m) =>
    MediaRecorder.isTypeSupported(m),
  );
  if (!mime) return null;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  renderFrame(ctx, 0, d);

  const stream = canvas.captureStream(FPS);
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 9_000_000 });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);

  return new Promise((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mime.split(";")[0] }));
    recorder.onerror = reject;
    recorder.start(250);
    const start = performance.now();
    const tick = () => {
      const t = (performance.now() - start) / 1000;
      if (t >= TOTAL) {
        recorder.stop();
        stream.getTracks().forEach((tr) => tr.stop());
        onProgress?.(1);
        return;
      }
      renderFrame(ctx, t, d);
      onProgress?.(t / TOTAL);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

// 같은 기록은 한 번만 인코딩 (여러 번 공유해도 재사용)
let videoCache: { key: string; blob: Blob } | null = null;

function cacheKey(record: ShareRecord): string {
  return `${record.difficulty}:${record.dateKey}:${record.seed}:${record.timeSec}:${record.moves?.length}:${record.mistakes}:${record.hints}:${record.streak}:${record.best}`;
}

export async function renderShareVideo(record: ShareRecord, onProgress?: (p: number) => void): Promise<Blob | null> {
  if (!record.moves || record.moves.length === 0 || record.seed === undefined) return null;
  const key = cacheKey(record);
  if (videoCache?.key === key) {
    onProgress?.(1);
    return videoCache.blob;
  }
  await ensureFonts();
  const d = prepare(record);
  let blob: Blob | null = null;
  try {
    blob = await renderWithWebCodecs(d, onProgress);
  } catch {}
  if (!blob) {
    try {
      blob = await renderWithRecorder(d, onProgress);
    } catch {
      return null;
    }
  }
  if (blob) videoCache = { key, blob };
  return blob;
}

// 영상 공유: 네이티브 공유 시트(스토리/릴스 선택 가능) → 다운로드 폴백
// 반환: "shared" | "downloaded" | null(생성 불가)
export async function shareVideo(
  record: ShareRecord,
  text: string,
  onProgress?: (p: number) => void,
): Promise<"shared" | "downloaded" | null> {
  const blob = await renderShareVideo(record, onProgress);
  if (!blob) return null;
  const ext = blob.type.includes("mp4") ? "mp4" : "webm";
  const file = new File([blob], `sudoku-recap.${ext}`, { type: blob.type });
  if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
      return "shared";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "shared";
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return "downloaded";
}
