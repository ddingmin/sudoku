// E2E: 승리 모달의 '이미지 저장'으로 공유 PNG 다운로드 검증
import { chromium } from "playwright-core";
import { generateDaily } from "../lib/sudoku";

const OUT = process.env.OUT_DIR ?? ".";

async function main() {
  const { puzzle, solution } = generateDaily("normal");
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const page = await ctx.newPage();
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  const cells = page.locator('[role="grid"] button');
  for (let i = 0; i < 81; i++) {
    if (puzzle[i] !== 0) continue;
    await cells.nth(i).click();
    await page.keyboard.press(String(solution[i]));
  }
  await page.waitForTimeout(2200); // 웨이브 + 모달 대기

  const downloadPromise = page.waitForEvent("download", { timeout: 30000 });
  await page.getByRole("button", { name: "이미지 저장" }).click();
  const download = await downloadPromise;
  const path = `${OUT}/share-image.png`;
  await download.saveAs(path);
  console.log("downloaded:", download.suggestedFilename(), "->", path);

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
