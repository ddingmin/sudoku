// E2E: 실시간 대결 — A가 방을 만들고 링크 복사 → B가 링크로 참가 → 카운트다운 → 동시에 풀기(B가 먼저 완주) → 양쪽 결과 모달 → 결과 링크
// 실행: 개발 서버(localhost:3000) 띄운 뒤 OUT_DIR=<스크린샷 폴더> npx tsx scripts/e2e-room.ts
import { chromium, Page } from "playwright-core";
import { generatePuzzle } from "../lib/sudoku";

const OUT = process.env.OUT_DIR ?? ".";
const BASE = process.env.BASE ?? "http://localhost:3000";
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

  // A: 방 만들기
  await a.goto(BASE, { waitUntil: "networkidle" });
  await a.waitForTimeout(600);
  await a.getByRole("button", { name: "친구와 대결" }).click();
  await a.getByRole("button", { name: "쉬움" }).click();
  await a.getByRole("button", { name: "방 만들기" }).click();
  await a.getByText("친구를 기다리는 중").waitFor({ timeout: 10000 });
  await a.screenshot({ path: `${OUT}/room-a-waiting.png` });
  await a.getByRole("button", { name: "링크 복사" }).click();
  await a.waitForTimeout(300);
  const url = await a.evaluate(() => navigator.clipboard.readText());
  console.log("방 링크:", url);
  const id = url.split("/room/")[1];

  // 방 정보(시드)는 서버에서 — 테스트용으로 스냅샷 API 사용
  const token = await a.evaluate((rid) => localStorage.getItem(`sudoku:room:${rid}`), id);
  const view = await (await fetch(`${BASE}/api/room/${id}?token=${token}`)).json();
  const { puzzle, solution } = generatePuzzle(view.difficulty, view.seed);

  // B: 랜딩 → 참가
  await b.goto(url, { waitUntil: "networkidle" });
  await b.screenshot({ path: `${OUT}/room-b-landing.png`, fullPage: true });
  const og = await b.locator('meta[property="og:image"]').getAttribute("content");
  if (og) console.log("초대 OG:", (await b.request.get(og)).status());
  await b.getByRole("link", { name: "참가하기" }).click();
  await b.waitForURL((u) => u.pathname === "/");

  // 양쪽 카운트다운
  await a.getByText("같은 문제, 동시에 시작").waitFor({ timeout: 10000 });
  await b.getByText("같은 문제, 동시에 시작").waitFor({ timeout: 10000 });
  await a.screenshot({ path: `${OUT}/room-countdown.png` });
  await a.getByLabel("대결 진행").waitFor({ timeout: 10000 });
  await b.getByLabel("대결 진행").waitFor({ timeout: 10000 });
  await a.waitForTimeout(1200);

  // A가 몇 칸 채우면 B 보드에 점이 뜬다
  const n = await fill(a, puzzle, solution, 6);
  await b.waitForTimeout(1500);
  const barB = await b.getByLabel("대결 진행").innerText();
  console.log("B 스트립:", barB.replace(/\n/g, " | "));
  const dotsB = await b.locator('[role="grid"] button span[aria-hidden]').count();
  console.log("B 보드 친구 마커:", dotsB);
  await b.screenshot({ path: `${OUT}/room-b-playing.png` });

  // B가 전부 풀어 먼저 완주
  await fill(b, puzzle, solution, n);
  await b.getByText(/이겼다/).waitFor({ timeout: 15000 });
  await b.screenshot({ path: `${OUT}/room-b-win.png` });
  console.log("B 결과:", await b.locator("p.font-display").first().innerText());

  // A는 배너를 보고 계속 풀어 완주 → 졌다
  await a.getByText("친구가 먼저 다 풀었어요").waitFor({ timeout: 10000 });
  await a.screenshot({ path: `${OUT}/room-a-banner.png` });
  await fill(a, puzzle, solution, n - 6, 6);
  await a.getByText(/졌다/).waitFor({ timeout: 15000 });
  await a.screenshot({ path: `${OUT}/room-a-lose.png` });
  const card = await a.getByText(/기록이 .* 빨라요|같은 시간이에요/).innerText();
  console.log("A 결과 문장:", card);

  // 결과 공유 링크
  await a.getByRole("button", { name: "결과 공유" }).click();
  await a.waitForTimeout(300);
  const clip = await a.evaluate(() => navigator.clipboard.readText());
  console.log("결과 텍스트:\n" + clip);
  const resultUrl = clip.split("\n").find((l) => l.startsWith("http"))!;
  const res = await a.goto(resultUrl, { waitUntil: "networkidle" });
  console.log("결과 페이지:", res?.status(), await a.title());
  await a.screenshot({ path: `${OUT}/room-result.png`, fullPage: true });
  const og2 = await a.locator('meta[property="og:image"]').getAttribute("content");
  if (og2) console.log("결과 OG:", (await a.request.get(og2)).status());

  // B: 다시 붙기 → 새 방 대기
  await b.getByRole("button", { name: "다시 붙기" }).click();
  await b.getByText("친구를 기다리는 중").waitFor({ timeout: 10000 });
  console.log("재대결 방 생성 OK");

  await browser.close();
  console.log("E2E ROOM DONE");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
