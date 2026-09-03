// E2E: 기록 v1→v2 마이그레이션, 잔디 렌더, 기록 옮기기 링크 복원 검증 (요: 서버 + Chrome)
// 실행: BASE=http://localhost:3123 OUT_DIR=/tmp npx tsx scripts/e2e-records.ts
import { chromium } from "playwright-core";
import { encodeBackup } from "../lib/backup";
import { dailyKeyFromNumber, dailyNumber, todayKey } from "../lib/sudoku";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = process.env.OUT_DIR ?? ".";
let fails = 0;
const check = (c: boolean, m: string) => { console.log(c ? "OK  " : "FAIL", m); if (!c) fails++; };

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const t = dailyNumber(todayKey());
  // v1 형식 기록: 오늘·어제·그제 + 5일 전 데일리 클리어 (스트릭 3, 최장 3)
  const legacy = {
    bests: { normal: 400, hard: 1200 }, played: 9, cleared: 6, streak: 3, maxStreak: 3, lastDailyKey: todayKey(),
    history: [0, 1, 2, 5].map((o) => ({ difficulty: o === 1 ? "hard" : "normal", timeSec: 400 + o * 10, mistakes: 1, hints: 0, dateKey: dailyKeyFromNumber(t - o), daily: true, finishedAt: Date.now() })),
  };

  // 1) 기기 A: v1 기록 → 마이그레이션 → 기록 패널
  const a = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pa = await a.newPage();
  // 앱이 v2를 만들기 전에 v1만 심어둔다 (기존 사용자가 새 버전을 처음 여는 상황)
  await pa.goto(`${BASE}/restore`, { waitUntil: "networkidle" });
  await pa.evaluate((raw) => { localStorage.removeItem("sudoku:stats:v2"); localStorage.setItem("sudoku:stats:v1", raw); }, JSON.stringify(legacy));
  await pa.goto(BASE, { waitUntil: "networkidle" });
  await pa.getByLabel("기록 보기").click();
  await pa.waitForTimeout(600);
  const v2 = await pa.evaluate(() => JSON.parse(localStorage.getItem("sudoku:stats:v2") ?? "null"));
  check(v2 && Object.keys(v2.days).length === 4 && v2.streak === undefined, `v1→v2 마이그레이션: days ${v2 && Object.keys(v2.days).length}개, streak 필드 없음`);
  const panel = await pa.locator("text=매일의 기록").isVisible();
  check(panel, "잔디 섹션 표시");
  const summary = await pa.locator("text=/일 클리어 · 최장/").innerText();
  check(summary.includes("4일 클리어") && summary.includes("최장 3일"), `잔디 요약: ${summary}`);
  const streakTile = await pa.getByText("연속", { exact: true }).locator("..").innerText();
  check(streakTile.includes("3일"), `스트릭 타일(파생): ${streakTile.replace(/\s+/g, " ")}`);
  const greenCells = await pa.locator('[aria-label="날짜별 클리어 기록"] span[title*="·"]:not([title*="미클리어"])').count();
  check(greenCells === 4, `잔디 채워진 칸 ${greenCells}`);
  await pa.screenshot({ path: `${OUT}/e2e-records-panel.png` });
  await pa.evaluate(() => { document.documentElement.dataset.theme = "dark"; });
  await pa.waitForTimeout(200);
  await pa.screenshot({ path: `${OUT}/e2e-records-panel-dark.png` });

  // 2) 기기 B(빈 기록): 백업 링크 열기 → 불러오기 → 병합 확인
  const code = encodeBackup(v2);
  const b = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pb = await b.newPage();
  await pb.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await pb.evaluate(() => localStorage.setItem("sudoku:stats:v2", JSON.stringify({ bests: { normal: 350, easy: 200 }, played: 2, cleared: 2, days: { "2026-01-05": { easy: 200 } }, history: [] })));
  await pb.goto(`${BASE}/restore#${code}`, { waitUntil: "networkidle" });
  await pb.waitForTimeout(500);
  check(await pb.locator("text=이 기록을 불러올까요?").isVisible(), "복원 미리보기 표시");
  check(await pb.locator("text=이 기기의 기록 1일과 합쳐져요").isVisible(), "병합 안내 문구");
  await pb.screenshot({ path: `${OUT}/e2e-records-restore.png` });
  await pb.getByText("이 기기에 불러오기").click();
  await pb.waitForTimeout(300);
  const merged = await pb.evaluate(() => JSON.parse(localStorage.getItem("sudoku:stats:v2")!));
  check(Object.keys(merged.days).length === 5, `병합 후 days ${Object.keys(merged.days).length}개 (4+1)`);
  check(merged.bests.normal === 350 && merged.bests.hard === 1200 && merged.bests.easy === 200, `베스트 병합(최소): ${JSON.stringify(merged.bests)}`);
  check(merged.played === v2.played && merged.cleared === 6, `횟수 병합(최대): ${merged.played}/${merged.cleared}`);
  await pb.waitForURL(`${BASE}/`, { timeout: 4000 }).catch(() => {});
  check(pb.url() === `${BASE}/`, `복원 후 홈 이동: ${pb.url()}`);

  // 3) 깨진 링크
  await pb.goto(`${BASE}/restore#zzz`, { waitUntil: "networkidle" });
  check(await pb.locator("text=기록을 읽을 수").isVisible(), "잘못된 코드 안내");

  await browser.close();
  console.log(fails ? `${fails} FAIL` : "ALL OK", `(백업 코드 ${code.length}자)`);
  process.exit(fails ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
