// 생성기 검증: 난이도별 25회 생성 → 유일해 & 풀이 일치 확인
import { generatePuzzle, countSolutions, DIFFICULTIES } from "../lib/sudoku";

let failures = 0;
for (const diff of DIFFICULTIES) {
  const times: number[] = [];
  for (let i = 0; i < 25; i++) {
    const t0 = performance.now();
    const { puzzle, solution } = generatePuzzle(diff, i * 7919 + 13);
    times.push(performance.now() - t0);

    const clues = puzzle.filter((v) => v !== 0).length;
    const n = countSolutions([...puzzle], 2);
    if (n !== 1) {
      console.error(`FAIL ${diff} seed=${i}: solutions=${n}`);
      failures++;
    }
    for (let k = 0; k < 81; k++) {
      if (puzzle[k] !== 0 && puzzle[k] !== solution[k]) {
        console.error(`FAIL ${diff} seed=${i}: clue mismatch at ${k}`);
        failures++;
        break;
      }
    }
    if (i === 0) console.log(`${diff}: clues=${clues}`);
  }
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  console.log(`${diff}: avg gen ${avg.toFixed(1)}ms, max ${Math.max(...times).toFixed(1)}ms`);
}
console.log(failures === 0 ? "ALL PASS" : `${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
