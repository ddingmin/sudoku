// E2E: 오늘의 퍼즐(보통)을 자동으로 풀어 승리 모달/공유 카드 검증
import { chromium } from "playwright-core";
import { generateDaily } from "../lib/sudoku";

const OUT = process.env.OUT_DIR ?? ".";

async function main() {
  const { puzzle, solution } = generateDaily("normal");
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = await ctx.newPage();
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  const cells = page.locator('[role="grid"] button');
  // 마지막 한 칸을 남기고 채운다
  const empties: number[] = [];
  for (let i = 0; i < 81; i++) if (puzzle[i] === 0) empties.push(i);
  const last = empties.pop()!;

  for (const i of empties) {
    await cells.nth(i).click();
    await page.keyboard.press(String(solution[i]));
  }
  await page.screenshot({ path: `${OUT}/e2e-before-clear.png` });

  // 마지막 칸 → 클리어 웨이브
  await cells.nth(last).click();
  await page.keyboard.press(String(solution[last]));
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/e2e-wave.png` });

  // 승리 모달 대기
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `${OUT}/e2e-win-modal.png` });

  // 링크 복사 확인
  await page.getByRole("button", { name: "링크 복사" }).click();
  await page.waitForTimeout(400);
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  console.log("클립보드:\n" + clip);

  // 모달 닫고 통계 패널 확인
  await page.getByRole("button", { name: "닫기" }).click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "기록 보기" }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/e2e-stats.png` });

  // 공유 링크 유효성: 클립보드의 URL로 이동
  const url = clip.split("\n").find((l) => l.startsWith("http"));
  if (url) {
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/e2e-share-landing.png` });
    console.log("공유 링크 OK:", url);
  }

  await browser.close();
  console.log("E2E DONE");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
