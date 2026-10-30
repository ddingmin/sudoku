<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# 작업 규칙

`AGENTS.md`는 이 파일을 가리키는 심볼릭 링크다. 원본은 `CLAUDE.md` 하나.

## 빌드·테스트·린트와 완료 기준

- 린트(eslint)와 단위 테스트 러너(jest/vitest)는 **없다**(`package.json`에 스크립트·의존성 없음). 대신 아래 명령을 쓴다.
- `npm ci` (최초 setup, node_modules가 없을 때)
- `npm run typecheck` — `tsc --noEmit`. 약 2초.
- `npm run verify` — `scripts/verify-*.ts` 4개(퍼즐 유일해, 공유 코드, 백업 코드, 대결 서버 로직)를 `tsx`로 실행. 약 2초. 비밀값·서버 불필요(dev 서버가 없으면 HTTP 검증은 건너뛰고 "ALL OK"로 끝남).
- `npm run build` — `next build`. 미검증(이 문서를 쓰며 실행하지 않음).
- E2E: `scripts/e2e-*.ts`(Playwright, 설치된 Chrome 채널 사용)는 dev 서버(`localhost:3000`)가 떠 있어야 하고 `OUT_DIR=<스크린샷 폴더> npx tsx scripts/e2e-room.ts`처럼 개별 실행한다. `npm` 스크립트에 없고 CI도 없다(`.github/` 없음). 미검증.
- **완료 기준**: 코드 변경은 `npm run typecheck`와 `npm run verify`가 모두 통과해야 한다. 대결(방/SSE) 변경은 가능하면 dev 서버를 띄워 `e2e-room*.ts`까지 확인한다. 문서만 바꾸는 변경은 검증 생략 가능.

## 로컬 실행·포트·setup

- `npm run dev` → `http://localhost:3000` (Next 기본 포트, 코드에서 따로 지정하지 않음). 홈서버 운영 포트(80/443, 27017)와 겹치지 않는다. 3000이 사용 중이면 `npm run dev -- -p <포트>`로 바꾸고 E2E는 `BASE=http://localhost:<포트>`를 준다.
- 외부 서비스·비밀값 없이 돈다. 환경 변수는 모두 선택이며 `.env*`는 gitignore 대상이라 열거나 커밋하지 않는다.
  - `KV_REST_API_URL`/`KV_REST_API_TOKEN` 또는 `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`: 대결 방 저장소(Upstash Redis). 없으면 인메모리 저장소로 동작해 로컬 대결 테스트 가능(배포에서는 Redis 필수). 로컬에서 운영 Redis에 붙이지 않는다.
  - `NEXT_PUBLIC_SITE_URL`: Vercel 외 호스팅에서 OG 이미지 절대 URL용.
- 배포는 Vercel(원격 작업이므로 사용자 승인 없이 하지 않는다).
- Next.js 16 / React 19 / Tailwind 4. 코드를 쓰기 전에 위 블록대로 `node_modules/next/dist/docs/`의 관련 가이드를 읽는다.

## 건드리면 안 되는 영역과 브랜치·커밋·PR

- 디자인은 `DESIGN.md`("키치 팝")를 따른다. `app/globals.css`의 시맨틱 토큰·유틸리티만 쓰고 hex 하드코딩 금지.
- 대결의 시간·정답 판정은 서버(`lib/roomServer.ts`)가 권위다. 방 갱신은 `lib/store.ts`의 CAS(ver 비교-후-교체)로만 한다. 설계 변경 시 `docs/realtime-duel.md`도 맞춘다.
- 공유 코드(`lib/encode.ts`)·백업 코드(`lib/backup.ts`)는 구버전 링크 호환이 있다. 포맷을 바꾸면 `verify-encode`/`verify-backup`이 통과해야 한다.
- `.env*`, 키, 토큰은 읽거나 출력하지 않는다. `package-lock.json`은 의존성 변경 때만 `npm`으로 갱신하고 손으로 고치지 않는다.
- 브랜치/PR 규칙: 문서화된 규칙은 **없음**(미확인). 기본 브랜치는 `main`. push·PR 생성은 사용자 확인 후에만.
- 앱 이름은 **"스도쿠"** 단독. "매일 한 판" 같은 태그라인을 붙이지 않는다. 헤더 스티커는 데일리 번호(`#247`)를 표시한다.

### 커밋

- 커밋 메시지에 `Co-Authored-By: Claude ...` 같은 AI 공동 저자 트레일러를 **절대 넣지 않는다.** 저자는 사용자 한 명이다.
- 커밋 메시지는 한국어 한 줄 제목(+ 필요 시 본문). 기존 로그 톤을 따른다(예: `실시간 대결 자가 피드백 5회차: …`, `e2e-room: …`).

## 작업을 나누는 경계

레이어별로 소유 파일이 갈린다. 같은 파일을 두 워커가 동시에 맡지 않는다.

- **퍼즐·기록 로직(순수 TS)**: `lib/sudoku.ts`, `encode.ts`, `backup.ts`, `stats.ts`, `recap.ts`, `palette.ts` — 검증은 `verify-sudoku/encode/backup`.
- **대결 서버**: `lib/room.ts`(공용 타입, 클라와 공유), `roomServer.ts`, `store.ts`, `app/api/room/**` — 검증은 `verify-room`. `room.ts`를 바꾸면 클라이언트 쪽도 영향받으므로 한 Task로 묶는다.
- **대결 클라이언트**: `lib/useRoom.ts`, `roomClient.ts`, `duelText.ts`, `components/Duel*`, `Room*`, `app/room/**`, `app/result/**`.
- **게임 UI**: `lib/useGame.ts`, `components/`(Board, NumberPad, Controls, WinModal …), `app/page.tsx`, `app/globals.css`.
- **공유·OG**: `lib/shareImage.ts`, `shareVideo.ts`, `og.tsx`, `components/Share*`, `app/share/**`, `app/restore/**`.
- **스크립트·문서**: `scripts/`, `README.md`, `DESIGN.md`, `docs/` — 코드 Task와 분리해도 충돌이 적다.
