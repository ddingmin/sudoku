import { chromium } from "playwright-core";
import { generateDaily } from "../lib/sudoku";

async function main() {
  const { puzzle, solution } = generateDaily("normal");
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() !== "log" || m.text().includes("HMR") === false) console.log("[console]", m.type(), m.text()); });
  page.on("pageerror", (e) => console.log("[pageerror]", e.message));
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const cells = page.locator('[role=\"grid\"] button');
  for (let i = 0; i < 81; i++) {
    if (puzzle[i] !== 0) continue;
    await cells.nth(i).click();
    await page.keyboard.press(String(solution[i]));
  }
  await page.waitForTimeout(2200);
  const btn = page.getByRole("button", { name: /자랑하기/ });
  console.log("버튼 라벨:", await btn.innerText());
  page.on("download", (d) => console.log("[download]", d.suggestedFilename()));
  await btn.click();
  for (let s = 0; s < 24; s++) {
    await page.waitForTimeout(2500);
    const label = await btn.innerText().catch(() => "?");
    const toast = await page.locator("p").filter({ hasText: /실패|저장|복사/ }).first().innerText().catch(() => "");
    console.log(`t+${(s + 1) * 2.5}s 버튼: ${label} 토스트: ${toast}`);
    if (toast) break;
  }
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
