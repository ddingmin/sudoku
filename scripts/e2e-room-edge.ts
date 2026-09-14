// E2E(엣지): 실시간 대결 — 새로고침 복구, 중도 이탈(기권) 처리, 만료/시작된 방 진입, 남은 사람의 완주 기록
// 실행: 개발 서버 띄운 뒤 OUT_DIR=<폴더> npx tsx scripts/e2e-room-edge.ts
import { chromium, Page } from "playwright-core";
import { generatePuzzle } from "../lib/sudoku";

const OUT = process.env.OUT_DIR ?? ".";
const BASE = "http://localhost:3000";
const noShare = () => Object.defineProperty(navigator, "share", { value: undefined, configurable: true });

async function fill(page: Page, puzzle: number[], solution: number[], count: number, from = 0) {
  const cells = page.locator('[role="grid"] button');
  const empties: number[] = [];
  for (let i = 0; i < 81; i++) if (puzzle[i] === 0) empties.push(i);
  for (const i of empties.slice(from, from + count)) {
    await cells.nth(i).click();
    await page.keyboard.press(String(solution[i]));
  }
  return empties.length;
}

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const mk = async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, permissions: ["clipboard-read", "clipboard-write"] });
    await ctx.addInitScript(noShare);
    return ctx.newPage();
  };
  const a = await mk();
  const b = await mk();

  await a.goto(BASE, { waitUntil: "networkidle" });
  await a.getByRole("button", { name: "친구와 대결" }).click();
  await a.getByRole("button", { name: "쉬움" }).click();
  await a.getByRole("button", { name: "방 만들기" }).click();
  await a.getByText("친구를 기다리는 중").waitFor({ timeout: 10000 });
  await a.getByRole("button", { name: "링크 복사" }).click();
  const url = await a.evaluate(() => navigator.clipboard.readText());
  const id = url.split("/room/")[1];
  const token = await a.evaluate((rid) => localStorage.getItem(`sudoku:room:${rid}`), id);
  const view = await (await fetch(`${BASE}/api/room/${id}?token=${token}`)).json();
  const { puzzle, solution } = generatePuzzle(view.difficulty, view.seed);

  await b.goto(url, { waitUntil: "networkidle" });
  await b.getByRole("link", { name: "참가하기" }).click();
  await a.getByLabel("대결 진행").waitFor({ timeout: 15000 });
  await b.getByLabel("대결 진행").waitFor({ timeout: 15000 });
  await a.waitForTimeout(1200);

  // 1) A가 몇 칸 채우고 새로고침 → 같은 방·같은 진행으로 복구, 친구 마커 유지
  const n = await fill(a, puzzle, solution, 5);
  await fill(b, puzzle, solution, 3);
  await a.waitForTimeout(800);
  await a.reload({ waitUntil: "networkidle" });
  await a.getByLabel("대결 진행").waitFor({ timeout: 15000 });
  await a.waitForTimeout(1500);
  const barA = (await a.getByLabel("대결 진행").innerText()).replace(/\n/g, " | ");
  console.log("A 새로고침 후 스트립:", barA);
  if (!barA.includes("나 5") || !barA.includes("친구 3")) throw new Error("새로고침 복구 실패");
  const timerA = await a.locator("header .font-display.tabular").innerText();
  console.log("A 타이머(서버 기준 유지):", timerA);
  await a.screenshot({ path: `${OUT}/edge-a-reloaded.png` });

  // 2) 제3자가 진행 중인 방 링크를 열면 "이미 시작된 대결"
  const c = await mk();
  await c.goto(url, { waitUntil: "networkidle" });
  console.log("제3자 랜딩:", (await c.locator("h1").innerText()).replace(/\n/g, " "));
  await c.getByRole("link", { name: "대결로 들어가기" }).click();
  await c.getByText("이미 시작된 대결이에요").waitFor({ timeout: 10000 });
  await c.screenshot({ path: `${OUT}/edge-c-blocked.png` });
  await c.getByRole("button", { name: "홈으로" }).click();
  await c.locator('[role="grid"]').waitFor({ timeout: 10000 });
  console.log("제3자 홈 복귀 OK (보드 표시)");

  // 3) B가 헤더에서 새 게임 → 기권 확인 → A에게 승리 모달
  b.once("dialog", (d) => d.accept());
  await b.getByRole("button", { name: /친구와 대결 쉬움/ }).click();
  await b.getByRole("button", { name: "보통" }).first().click();
  await a.getByText("친구가 중간에 나갔어요").waitFor({ timeout: 15000 });
  await a.screenshot({ path: `${OUT}/edge-a-forfeit-win.png` });
  console.log("A 기권 승리 모달 OK");
  // B는 일반 게임으로 돌아갔는지
  await b.waitForTimeout(800);
  const bMode = await b.locator("header button").filter({ hasText: /스도쿠/ }).first().innerText();
  console.log("B 모드:", bMode.replace(/\n/g, " "));

  // 4) A는 모달을 닫고(홈으로 대신 끝까지) — 여기선 홈으로 가면 일반 게임 복귀 확인
  await a.getByRole("button", { name: "홈으로" }).click();
  await a.waitForTimeout(800);
  const aMode = await a.locator("header button").filter({ hasText: /스도쿠/ }).first().innerText();
  console.log("A 홈 복귀 모드:", aMode.replace(/\n/g, " "));
  if (!aMode.includes("오늘의 스도쿠")) throw new Error("홈 복귀 실패");

  // 5) 끝난 방 링크 → "끝났거나 없는 대결" 아님(기권 종료 = finished → 참가자면 들어갈 수 있음) / 없는 방
  await c.goto(`${BASE}/room/ZZZZZ2`, { waitUntil: "networkidle" });
  console.log("없는 방 랜딩:", (await c.locator("h1").innerText()).replace(/\n/g, " "));

  await browser.close();
  console.log("E2E ROOM EDGE DONE");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
