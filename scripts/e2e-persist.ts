// E2E: 앱 전환/재로드 시 진행 상태 복원 검증
import { chromium } from "playwright-core";
import { generateDaily } from "../lib/sudoku";

async function main() {
  const { puzzle, solution } = generateDaily("normal");
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await page.waitForTimeout(900);

  const cells = page.locator('[role="grid"] button');
  const empties: number[] = [];
  for (let i = 0; i < 81; i++) if (puzzle[i] === 0) empties.push(i);

  // 정답 3개 + 오답 1개 입력
  for (const i of empties.slice(0, 3)) {
    await cells.nth(i).click();
    await page.keyboard.press(String(solution[i]));
  }
  const wrongCell = empties[3];
  const wrongVal = (solution[wrongCell] % 9) + 1;
  await cells.nth(wrongCell).click();
  await page.keyboard.press(String(wrongVal));
  await page.waitForTimeout(3200); // 타이머 진행

  const before = await page.evaluate(() => document.querySelector('[role="grid"]')!.textContent);

  // 재로드 (모바일 앱 전환 후 탭 재생성 시나리오 — pagehide에서 저장됨)
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1200);

  const after = await page.evaluate(() => document.querySelector('[role="grid"]')!.textContent);
  const mistakes = await page.getByLabel(/실수 \d+회/).innerText();
  const timer = await page.locator(".font-display.tabular").first().innerText();

  console.log("보드 복원:", before === after ? "OK" : `FAIL\nbefore=${before}\nafter=${after}`);
  console.log("실수 복원:", mistakes.includes("1") ? "OK (✕1)" : `FAIL (${mistakes})`);
  const [m, s] = timer.split(":").map(Number);
  console.log("타이머 복원:", m * 60 + s >= 3 ? `OK (${timer})` : `FAIL (${timer})`);

  // 새 게임(자유)으로 바꿨다가 데일리로 돌아오면 진행 이어짐
  await page.getByRole("button", { name: /오늘의 스도쿠 #/ }).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "쉬움" }).nth(1).click(); // 자유 스도쿠 쉬움
  await page.waitForTimeout(900);
  await page.getByRole("button", { name: /자유 스도쿠/ }).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "보통" }).first().click(); // 오늘의 스도쿠 보통
  await page.waitForTimeout(900);
  const resumed = await page.evaluate(() => document.querySelector('[role="grid"]')!.textContent);
  console.log("데일리 재선택 시 이어하기:", resumed === after ? "OK" : "FAIL");

  if (before !== after || resumed !== after) process.exit(1);
  await browser.close();
  console.log("E2E PERSIST DONE");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
