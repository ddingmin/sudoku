// E2E: 승리 모달의 '영상으로 자랑하기' → MP4 다운로드 검증 + 프레임 캡처
import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";
import { generateDaily } from "../lib/sudoku";

const OUT = process.env.OUT_DIR ?? ".";

async function main() {
  const diff = (process.env.DIFF ?? "normal") as "easy" | "normal" | "hard" | "expert";
  const { puzzle, solution } = generateDaily(diff);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  // 헤드리스에도 navigator.share가 존재해 시트를 영원히 기다림 → 다운로드 경로로 강제
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, "canShare", { value: undefined });
    Object.defineProperty(navigator, "share", { value: undefined });
  });
  const page = await ctx.newPage();
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  if (diff !== "normal") {
    await page.getByRole("button", { name: /오늘의 스도쿠 #/ }).click();
    const label = { easy: "쉬움", hard: "어려움", expert: "전문가" }[diff]!;
    await page.locator("div").filter({ hasText: /^오늘의 스도쿠/ }).getByRole("button", { name: label }).first().click();
    await page.waitForTimeout(800);
  }

  const cells = page.locator('[role="grid"] button');
  for (let i = 0; i < 81; i++) {
    if (puzzle[i] !== 0) continue;
    await cells.nth(i).click();
    await page.keyboard.press(String(solution[i]));
  }
  await page.waitForTimeout(2200);

  const downloadPromise = page.waitForEvent("download", { timeout: 120000 });
  await page.getByRole("button", { name: /영상으로 자랑하기/ }).click();
  const download = await downloadPromise;
  const path = `${OUT}/recap-video.${download.suggestedFilename().split(".").pop()}`;
  await download.saveAs(path);

  const buf = readFileSync(path);
  const head = buf.subarray(4, 12).toString("latin1");
  console.log("file:", download.suggestedFilename(), "size:", (buf.length / 1024).toFixed(0) + "KB", "header:", head);
  if (!head.startsWith("ftyp") && !buf.subarray(0, 4).toString("latin1").includes("\x1aE")) {
    throw new Error("MP4/WebM 헤더가 아님");
  }

  // 영상 프레임 캡처: blob을 <video>로 재생해 3s/6.9s 시점 스크린샷
  const b64 = buf.toString("base64");
  const mime = path.endsWith(".mp4") ? "video/mp4" : "video/webm";
  const frame = await ctx.newPage();
  await frame.setViewportSize({ width: 540, height: 960 });
  await frame.setContent(`<body style="margin:0;background:#000"><video id="v" width="540" height="960" muted src="data:${mime};base64,${b64}"></video></body>`);
  for (const t of [0.7, 3.5, 5.05, 7.2]) {
    await frame.evaluate(async (time) => {
      const v = document.getElementById("v") as HTMLVideoElement;
      await new Promise<void>((res) => {
        v.onseeked = () => res();
        v.currentTime = time;
      });
    }, t);
    await frame.waitForTimeout(200);
    await frame.screenshot({ path: `${OUT}/video-frame-${t}.png` });
    console.log(`frame @${t}s captured`);
  }

  // 캐시 확인: 두 번째 공유는 재인코딩 없이 즉시 완료되어야 함
  const t0 = Date.now();
  const dl2 = page.waitForEvent("download", { timeout: 15000 });
  await page.getByRole("button", { name: /영상으로 자랑하기/ }).click();
  await dl2;
  console.log("2번째 공유(캐시):", Date.now() - t0, "ms");

  await browser.close();
  console.log("E2E VIDEO DONE");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
