# 스도쿠 — 매일 한 판

매일 자정(KST)에 바뀌는 데일리 스도쿠. 다 풀면 풀이 과정을 리캡으로 돌려보고, 기록을 카드·영상·링크로 친구에게 자랑할 수 있습니다.

**▶ 플레이: https://sudoku-rho-lake.vercel.app**

## 특징

- **오늘의 퍼즐** — 날짜로 시드가 고정되어 모두가 같은 문제를 풉니다. 난이도 4단계(쉬움·보통·어려움·전문가), 유일해 보장. 자유 모드도 있습니다.
- **풀이 리캡** — 클리어하면 내가 채운 순서를 타임랩스로 재생하고 "한 칸에서 1분 35초를 고민했어요" 같은 하이라이트를 뽑아줍니다.
- **자랑하기** — 기록 카드 PNG, 풀이 타임랩스 MP4(브라우저에서 바로 인코딩), Wordle 스타일 텍스트, 공유 링크 중 골라서 공유합니다.
- **공유 링크** — 서버 저장 없이 URL 안에 기록과 풀이 순서를 통째로 담습니다(약 80~100자). 링크를 열면 친구 기록의 리캡이 재생되고, 카톡·X·슬랙 미리보기용 OG 카드가 자동 생성됩니다.
- **게임 도구** — 메모 모드, 되돌리기, 힌트, 숫자별 남은 개수, 키보드 입력. 진행 상태는 자동 저장되어 앱을 오갔다 와도 이어서 풉니다.
- **기록** — 난이도별 베스트, 완주율, 데일리 연속 클리어 스트릭.
- 라이트/다크 테마, 난이도별 키 컬러, 모바일 터치 최적화.

## 실행

```bash
npm install
npm run dev        # http://localhost:3000
```

```bash
npm run typecheck  # 타입 검사
npm run verify     # 퍼즐 생성기 유일해 검증 + 공유 코드 라운드트립 검증
npm run build
```

배포는 Vercel에 그대로 올리면 됩니다. OG 이미지의 절대 URL은 Vercel 환경에서 자동으로 잡히고, 다른 호스팅이라면 `NEXT_PUBLIC_SITE_URL`을 설정하세요.

## 구조

```
app/                  Next.js App Router (메인 게임, /share/[code] 공유 랜딩 + OG 이미지)
components/           보드·넘버패드·승리 모달·공유 카드 등 UI
lib/sudoku.ts         퍼즐 생성기 (시드 기반, 유일해 검증)
lib/useGame.ts        게임 상태·입력·저장
lib/encode.ts         공유 코드 인코딩/디코딩 (비트 패킹, 구버전 링크 호환)
lib/recap.ts          풀이 로그 → 하이라이트
lib/shareImage.ts     공유 카드 PNG (Canvas)
lib/shareVideo.ts     풀이 타임랩스 MP4 (WebCodecs + mp4-muxer)
scripts/              검증 스크립트, Playwright E2E
DESIGN.md             디자인 시스템 ("키치 팝") 토큰과 규칙
```

기술 스택: Next.js 16, React 19, Tailwind CSS 4, framer-motion, canvas-confetti, mp4-muxer.

## 라이선스

MIT. 폰트는 [Pretendard](https://github.com/orioncactus/pretendard)와 [Bagel Fat One](https://fonts.google.com/specimen/Bagel+Fat+One)(모두 SIL Open Font License)을 사용합니다.
