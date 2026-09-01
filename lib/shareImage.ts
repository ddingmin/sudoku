"use client";

// 공유 카드 PNG 렌더링 (Canvas) — 키치 팝 라이트 팔레트 고정
import { ShareRecord, formatTime } from "./encode";
import { DIFFICULTY_LABEL, dailyNumber } from "./sudoku";

const C = {
  primary: "#2b4cff",
  primaryStrong: "#1e38cc",
  surface: "#ffffff",
  ground: "#faf8f3",
  ink: "#141414",
  inkFaint: "#9b978c",
  pop: "#c8f04d",
  danger: "#e93a5e",
};

const DISPLAY = '"Bagel Fat One", "Pretendard Variable", sans-serif';
const SANS = '"Pretendard Variable", Pretendard, sans-serif';

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// 청키 박스: 하드 섀도 + 보더
function chunkyRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
  offset: number,
  border = 5,
) {
  ctx.fillStyle = C.ink;
  roundRect(ctx, x + offset, y + offset, w, h, r);
  ctx.fill();
  ctx.fillStyle = fill;
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = border;
  roundRect(ctx, x, y, w, h, r);
  ctx.stroke();
}

function checker(ctx: CanvasRenderingContext2D, y: number, height: number, cell: number, color: string, W: number) {
  ctx.save();
  ctx.fillStyle = color;
  for (let cy = 0; cy * cell < height; cy++) {
    for (let cx = 0; cx * cell < W; cx++) {
      if ((cx + cy) % 2 === 0) ctx.fillRect(cx * cell, y + cy * cell, cell, cell);
    }
  }
  ctx.restore();
}

// 회전 스티커
function sticker(ctx: CanvasRenderingContext2D, cx: number, cy: number, text: string, bg: string, fg: string, deg: number) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((deg * Math.PI) / 180);
  ctx.font = `800 34px ${SANS}`;
  const tw = ctx.measureText(text).width;
  const w = tw + 56;
  const h = 72;
  chunkyRect(ctx, -w / 2, -h / 2, w, h, 18, bg, 6, 5);
  ctx.fillStyle = fg;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 0, 2);
  ctx.restore();
}

export async function renderShareImage(record: ShareRecord): Promise<Blob> {
  try {
    await Promise.all([
      document.fonts.load(`400 200px ${DISPLAY}`),
      document.fonts.load(`800 40px ${SANS}`),
      document.fonts.ready,
    ]);
  } catch {}

  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // 블루 플러드 + 상하단 체커
  ctx.fillStyle = C.primary;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 0.55;
  checker(ctx, 0, 96, 48, C.primaryStrong, W);
  checker(ctx, H - 96, 96, 48, C.primaryStrong, W);
  ctx.globalAlpha = 1;

  // 타이틀
  ctx.save();
  ctx.translate(W / 2, 190);
  ctx.rotate(-0.04);
  ctx.textAlign = "center";
  ctx.fillStyle = C.ink;
  ctx.font = `400 120px ${DISPLAY}`;
  ctx.fillText("클리어!", 8, 8);
  ctx.fillStyle = C.surface;
  ctx.fillText("클리어!", 0, 0);
  ctx.restore();
  ctx.textAlign = "center";
  ctx.fillStyle = C.pop;
  ctx.font = `800 34px ${SANS}`;
  ctx.fillText("오늘 퍼즐 깼다. 자랑 각.", W / 2, 268);

  // 카드
  const cx = 100;
  const cy = 330;
  const cw = W - 200;
  const ch = 760;
  chunkyRect(ctx, cx, cy, cw, ch, 44, C.surface, 16, 6);

  // 카드 헤더
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = C.ink;
  ctx.font = `400 56px ${DISPLAY}`;
  ctx.fillText("스도쿠", cx + 56, cy + 108);
  ctx.textAlign = "right";
  ctx.fillStyle = C.inkFaint;
  ctx.font = `700 30px ${SANS}`;
  const sub = `${record.daily ? `#${dailyNumber(record.dateKey)} · ` : "자유 퍼즐 · "}${record.dateKey.replace(/-/g, ".")}`;
  ctx.fillText(sub, cx + cw - 56, cy + 104);

  // 클리어 타임 + 라임 스와이프
  ctx.textAlign = "center";
  ctx.fillStyle = C.inkFaint;
  ctx.font = `800 28px ${SANS}`;
  ctx.fillText("클 리 어  타 임", cx + cw / 2, cy + 230);
  ctx.font = `400 190px ${DISPLAY}`;
  const time = formatTime(record.timeSec);
  const timeW = ctx.measureText(time).width;
  ctx.save();
  ctx.translate(cx + cw / 2, cy + 400);
  ctx.rotate(-0.026);
  ctx.fillStyle = C.pop;
  roundRect(ctx, -timeW / 2 - 20, -58, timeW + 40, 96, 18);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = C.primary;
  ctx.fillText(time, cx + cw / 2, cy + 428);

  // 스탯 칩
  const stats: Array<[string, string]> = [
    ["난이도", DIFFICULTY_LABEL[record.difficulty]],
    ["실수", `${record.mistakes}`],
    ["힌트", `${record.hints}`],
  ];
  const gap = 20;
  const chipW = (cw - 112 - gap * (stats.length - 1)) / stats.length;
  stats.forEach(([label, value], i) => {
    const x = cx + 56 + (chipW + gap) * i;
    const y = cy + 520;
    chunkyRect(ctx, x, y, chipW, 130, 20, C.ground, 0, 4);
    ctx.fillStyle = C.inkFaint;
    ctx.font = `700 26px ${SANS}`;
    ctx.fillText(label, x + chipW / 2, y + 48);
    ctx.fillStyle = C.ink;
    ctx.font = `800 44px ${SANS}`;
    ctx.fillText(value, x + chipW / 2, y + 104);
  });

  // 카드 푸터
  ctx.strokeStyle = "#ece9e0";
  ctx.lineWidth = 3;
  ctx.setLineDash([12, 10]);
  ctx.beginPath();
  ctx.moveTo(cx + 56, cy + ch - 78);
  ctx.lineTo(cx + cw - 56, cy + ch - 78);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = C.inkFaint;
  ctx.font = `700 26px ${SANS}`;
  ctx.fillText("매일 한 판 · 스도쿠", cx + cw / 2, cy + ch - 30);

  // 스티커 (카드 위에)
  if (record.best) sticker(ctx, cx + cw - 30, cy + 6, "신기록!", C.danger, C.surface, 7);
  if (record.streak > 1) sticker(ctx, cx + 10, cy + 400, `${record.streak}일 연속`, C.pop, C.ink, -8);

  // 하단 카피
  ctx.fillStyle = C.surface;
  ctx.font = `800 34px ${SANS}`;
  ctx.fillText("이 기록, 깰 수 있어?", W / 2, H - 140);

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png");
  });
}

export async function downloadShareImage(record: ShareRecord) {
  const blob = await renderShareImage(record);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sudoku-${record.dateKey}-${formatTime(record.timeSec).replace(":", "m")}s.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// 모바일: 이미지 파일 자체를 공유 시트로
export async function shareImageFile(record: ShareRecord, text: string): Promise<boolean> {
  if (typeof navigator.canShare !== "function") return false;
  try {
    const blob = await renderShareImage(record);
    const file = new File([blob], "sudoku.png", { type: "image/png" });
    if (!navigator.canShare({ files: [file] })) return false;
    await navigator.share({ files: [file], text });
    return true;
  } catch (e) {
    return e instanceof DOMException && e.name === "AbortError";
  }
}
