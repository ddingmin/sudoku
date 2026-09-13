// E2E: 고스트 대결 전 과정 — A가 오늘의 퍼즐을 풀고 대결 신청 → B가 도전장 열고 받기 → 고스트 보며 클리어 → 답장 링크 → 결과 랜딩
// 실행: 개발 서버(localhost:3000) 띄운 뒤 OUT_DIR=<스크린샷 폴더> npx tsx scripts/e2e-duel.ts
import { chromium, Page } from "playwright-core";
import { generateDaily } from "../lib/sudoku";

const OUT = process.env.OUT_DIR ?? ".";
const BASE = "http://localhost:3000";

async function solve(page: Page, puzzle: number[], solution: number[], pauseEvery = 0) {
  const cells = page.locator('[role="grid"] button');
  const empties: number[] = [];
  for (let i = 0; i < 81; i++) if (puzzle[i] === 0) empties.push(i);
  for (let n = 0; n < empties.length; n++) {
    const i = empties[n];
    await cells.nth(i).click();
    await page.keyboard.press(String(solution[i]));
    if (pauseEvery && n % pauseEvery === pauseEvery - 1) await page.waitForTimeout(1100);
  }
}

// 헤드리스 Chrome에도 navigator.share가 있어 공유 시트로 빠진다 — 링크 내용을 검증하려면 클립보드 폴백을 강제
const noShare = () => Object.defineProperty(navigator, "share", { value: undefined, configurable: true });

async function main() {
  const { puzzle, solution } = generateDaily("normal");
  const browser = await chromium.launch({ channel: "chrome", headless: true });

  // ── A: 클리어 → 대결 신청 링크
  const ctxA = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, permissions: ["clipboard-read", "clipboard-write"] });
  await ctxA.addInitScript(noShare);
  const a = await ctxA.newPage();
  await a.goto(BASE, { waitUntil: "networkidle" });
  await a.waitForTimeout(800);
  await solve(a, puzzle, solution, 12); // 중간중간 멈춰 시간이 쌓이게
  await a.waitForTimeout(2200);
  await a.getByRole("button", { name: "친구에게 1:1 대결 신청" }).click();
  await a.waitForTimeout(500);
  const clipA = await a.evaluate(() => navigator.clipboard.readText());
  console.log("A 도전장:\n" + clipA);
  const duelUrl = clipA.split("\n").find((l) => l.startsWith("http"))?.replace("👉 ", "");
  if (!duelUrl) throw new Error("도전장 링크 없음");
  await a.screenshot({ path: `${OUT}/duel-a-win.png` });

  // ── B: 도전장 랜딩 → 받기 → 고스트 확인
  const ctxB = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, permissions: ["clipboard-read", "clipboard-write"] });
  await ctxB.addInitScript(noShare);
  const b = await ctxB.newPage();
  await b.goto(duelUrl, { waitUntil: "networkidle" });
  await b.waitForTimeout(700);
  await b.screenshot({ path: `${OUT}/duel-b-landing.png`, fullPage: true });
  const og = await b.locator('meta[property="og:image"]').getAttribute("content");
  console.log("OG:", og);
  if (og) {
    const res = await b.request.get(og);
    console.log("OG 응답:", res.status(), res.headers()["content-type"]);
  }
  await b.getByRole("link", { name: "도전 받기" }).click();
  await b.waitForURL((u) => u.origin === BASE && u.pathname === "/");
  await b.waitForTimeout(1200);
  console.log("받기 후 URL:", b.url(), "| current:", await b.evaluate(() => localStorage.getItem("sudoku:current:v1")));
  const bar = b.getByLabel("고스트 대결 진행");
  if (!(await bar.isVisible())) {
    await b.screenshot({ path: `${OUT}/duel-b-fail.png` });
    throw new Error("DuelBar 없음");
  }
  console.log("DuelBar:", (await bar.innerText()).replace(/\n/g, " | "));
  await b.waitForTimeout(3500); // 고스트가 몇 칸 채우길 기다림
  console.log("DuelBar(3.5s):", (await bar.innerText()).replace(/\n/g, " | "));
  await b.screenshot({ path: `${OUT}/duel-b-playing.png` });

  // 새로고침해도 대결이 이어지는지
  await b.reload({ waitUntil: "networkidle" });
  await b.waitForTimeout(900);
  if (!(await b.getByLabel("고스트 대결 진행").isVisible())) throw new Error("새로고침 후 DuelBar 사라짐");
  console.log("새로고침 후 대결 유지 OK");

  // B 클리어 (빠르게 → 승리)
  await solve(b, puzzle, solution);
  await b.waitForTimeout(2300);
  await b.screenshot({ path: `${OUT}/duel-b-win.png` });
  const headline = await b.locator("p.font-display").first().innerText();
  console.log("B 결과 헤드라인:", headline);
  await b.getByRole("button", { name: "결과 답장 보내기" }).click();
  await b.waitForTimeout(500);
  const clipB = await b.evaluate(() => navigator.clipboard.readText());
  console.log("B 답장:\n" + clipB);
  const replyUrl = clipB.split("\n").find((l) => l.startsWith("http"))?.replace("👉 ", "");
  if (!replyUrl) throw new Error("답장 링크 없음");

  // ── 답장 랜딩
  await a.goto(replyUrl, { waitUntil: "networkidle" });
  await a.waitForTimeout(700);
  await a.screenshot({ path: `${OUT}/duel-reply-landing.png`, fullPage: true });
  const og2 = await a.locator('meta[property="og:image"]').getAttribute("content");
  if (og2) {
    const res = await a.request.get(og2);
    console.log("답장 OG 응답:", res.status(), res.headers()["content-type"]);
  }
  console.log("답장 랜딩 제목:", await a.title());

  await browser.close();
  console.log("E2E DUEL DONE");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
