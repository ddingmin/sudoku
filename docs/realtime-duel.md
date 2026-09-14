# 실시간 1:1 대결 — 설계

고스트 대결(링크에 풀이 로그를 담아 비동기로 붙는 방식)을 걷어내고, 두 사람이 **같은 시각에 같은 퍼즐을 풀며 서로의 진행을 실시간으로 보는** 대결로 바꾼다.
전송은 서버 → 클라이언트 SSE, 클라이언트 → 서버 POST. 상태는 Redis에 두고, 시간·정답 판정은 서버가 한다.

## 왜 서버가 필요한가

- Vercel 함수 인스턴스는 요청마다 같은 인스턴스가 보장되지 않는다. A의 POST를 받은 인스턴스와 B의 SSE를 쥔 인스턴스가 다를 수 있으므로 방 상태는 **외부 저장소**에 있어야 한다.
- 저장소: **Upstash Redis** (Vercel Marketplace, `vercel integration add upstash`). 키-값·TTL·원자적 갱신이 필요한 전부이고, 환경 변수가 프로젝트에 자동 주입된다. 무료 티어(10k 커맨드/일)로 시작.
- 고스트 방식에서 불가능했던 **검증**이 가능해진다: 시작·완주 시각은 서버 시계, 정답 여부는 서버가 보관한 해답으로 확인.

## 플로우

```
A 홈 → "친구와 실시간 대결" → 난이도 → 방 생성 → 링크 공유 → 로비 대기
B 링크(/room/abc123) → 랜딩(난이도 · 대기 중) → "참가하기" → /#room=abc123 → 조인
서버: 2명 확인 → startAt = now + 4s → 양쪽 카운트다운 3·2·1 → 같은 시드 퍼즐 시작
플레이: 정답 칸마다 POST → Redis → SSE → 상대 보드에 점 + 하단 스트립("친구보다 3칸 앞서요")
종료: 먼저 다 채운 쪽이 승 (서버가 finishedAt 기록) → 양쪽 결과 모달 → 결과 공유 링크 / 다시 붙기
```

- **상대가 먼저 끝나면**: "친구가 먼저 끝냈어요" 배너. 나는 계속 풀어 내 시간을 남길 수 있고(카드에 "N분 차"), 바로 결과를 볼 수도 있다.
- **재대결**: 결과 모달 "다시 붙기" → 서버가 새 방을 만들어 양쪽에 `rematch` 이벤트 → 자동 이동. 난이도 유지.
- **끊김/이탈**: SSE는 EventSource가 자동 재접속(재접속 시 스냅샷 재수신). 상대가 30초 이상 안 보이면 "연결이 끊겼어요" 배너, 60초면 기권 처리(남은 쪽 승). "나가기"는 확인 후 기권.
- **방 수명**: 생성 후 30분 내 미참가 시 만료. 진행 중 방은 3시간 TTL.

## 서버

### 데이터 (Redis)

```
room:{id}  JSON, TTL 3h
  id, difficulty, seed, puzzle[81], solution[81]      // 생성 시 만들어 저장 — 검증용
  status: "waiting" | "countdown" | "playing" | "finished" | "abandoned"
  createdAt, startAt?                                   // 서버 시각(ms)
  players: { host: Player, guest?: Player }
  ver: number                                           // 변경마다 +1 — SSE가 이 값만 보고 변경을 감지
  rematchId?: string

Player: { token, cells: number[], mistakes, hints, finishedAt?, forfeit?, lastSeen }
```

### 라우트 (App Router, Node 런타임)

| 메서드 | 경로 | 역할 |
|---|---|---|
| POST | `/api/room` | 방 생성 `{difficulty}` → `{id, token}`. 퍼즐 생성 후 저장. IP당 분당 10회 제한 |
| POST | `/api/room/[id]/join` | 참가 → `{token}`. 2명이 되면 `status=countdown`, `startAt=now+4000` |
| GET | `/api/room/[id]/events` | **SSE**. 연결 시 `state` 스냅샷, 이후 변경마다 `state`, 15초마다 `ping {now}` |
| POST | `/api/room/[id]/progress` | `{cells, mistakes, hints}` — cells는 정답 칸 인덱스 누적. 서버가 해답과 대조해 오답 인덱스는 버림 |
| POST | `/api/room/[id]/finish` | `{values[81]}` — 서버가 해답과 전체 비교. 맞으면 `finishedAt=now` |
| POST | `/api/room/[id]/leave` | 기권 |
| POST | `/api/room/[id]/rematch` | 같은 난이도로 새 방 생성, `rematchId` 기록 |

- 인증: 방 생성/참가 시 발급한 랜덤 토큰을 `Authorization: Bearer`로. 클라이언트는 `localStorage["sudoku:room:{id}"]`에 보관(새로고침 복구).
- **SSE 구현**: 핸들러 루프가 500ms마다 `room:{id}`의 `ver`를 읽어 바뀌었을 때만 스냅샷을 보낸다(스냅샷 ~300B, diff 불필요). 같은 루프에서 15초마다 내 `lastSeen`을 갱신 — SSE 연결이 살아 있는 것 자체가 heartbeat. `request.signal` abort 시 정리.
  `export const maxDuration = 300`(Hobby 상한). 만료 직전 서버가 스트림을 정상 종료하면 EventSource가 재접속하고 스냅샷을 다시 받는다.
  최적화 여지: Redis pub/sub(TCP `rediss://`)으로 폴링 제거 — 1차에서는 넣지 않는다.
- **시간 권위**: `startAt`, `finishedAt` 모두 서버. 클라 타이머는 `serverNow − startAt`으로 그리고, `ping`의 `now`로 시계 오프셋을 보정한다.
- **비용**: 폴링 2 cmd/s/연결 → 15분 대결 2명 ≈ 3,600 커맨드. 무료 10k/일이면 하루 2~3판, 유료는 100k당 $0.2(월 1,000판 ≈ $7). 부담되면 폴링 1s.

## 클라이언트

- `lib/room.ts` — 타입, API 클라이언트(fetch 래퍼), 결과 코드 인코딩(아래)
- `lib/useRoom.ts` — EventSource 관리, 상태 머신 `lobby → countdown → playing → finished`, 시계 오프셋, progress 전송(정답 입력 즉시, 250ms 스로틀), 재접속 시 스냅샷 병합
- `lib/useGame.ts` — `newRoomGame({seed, difficulty, startAt})`. 대결 중엔 타이머를 서버 기준으로, 새 게임 메뉴 잠금(나가기 확인)
- 컴포넌트
  - `RoomLobby` — 난이도 선택 → 방 만들기 → 링크 공유(공유 시트/복사) → "친구를 기다리는 중". 참가자 쪽은 "잠시 후 시작"
  - `Countdown` — 3·2·1 오버레이(startAt 기준이라 양쪽이 같은 순간에 시작)
  - `DuelBar` **재사용** — 실시간 데이터로 (나 31 · 친구 34 · "친구보다 3칸 뒤에 있어요")
  - `Board` 마커 **재사용** — 친구가 채운 칸 점(숫자 비공개), 오답은 표시하지 않음(서버가 오답을 버리므로)
  - `WinModal` 대결 모드 + `DuelResultCard` **재사용** — "이겼다! / 졌다", 나 vs 친구, "결과 공유", "다시 붙기"
  - 끊김 배너, 상대 완주 배너
- 진입: `/room/[id]` 랜딩(서버 컴포넌트, Redis에서 상태 읽어 "보통 · 친구가 기다리고 있어요" + OG) → "참가하기" → `/#room=abc123`(기존 부트 인텐트 방식) → `join`

## 결과 공유

두 사람의 기록(난이도 · 시간 · 실수 · 힌트 × 2, 시드)만 비트 패킹해 `/result/<code>` (약 20자). 무브가 없으니 짧고, 서버 없이 영구히 열린다. OG는 VS 카드(기존 답장 OG 구성 재사용).

## 정책

- 힌트: **대결 중 비활성** (제안). 실시간에서 힌트는 곧 시간 단축이라 공정성이 깨진다. 허용하려면 카드에 표기하는 기존 방식 유지.
- 승패: 완주 시각 순. 상대 기권 시 승. 둘 다 기권/만료 시 무효.
- 기록: 대결 판은 플레이 +1, 클리어하면 **자유 게임**으로 집계(방 시드는 무작위이므로 잔디·스트릭에 들어가지 않음). 히스토리에는 남아 리캡·공유 가능.
- 검증: 정답·시간은 서버 판정. 힌트 수는 클라 신고(표시용).

## 제거 (고스트 대결)

| 삭제 | 유지·전용 |
|---|---|
| `lib/duel.ts` 코드 인코딩·체크포인트·`restoreTimes`·`ghostCells` | `judge` `verdictText` `gapText` `OUTCOME_LABEL` → `lib/duelText.ts` |
| `app/duel/[code]/*` (도전장·답장 랜딩, OG) | `lib/og.tsx` |
| `useGame` `newDuel`, 저장 슬롯 `duel`, 부트 인텐트 `duel` (→ `room`) | `Board` 마커, `DuelBar`, `DuelResultCard`, `WinModal` 대결 모드 |
| `StatsPanel` 대결 신청 버튼, `WinModal` "친구에게 대결 신청" | (홈 메뉴 "친구와 실시간 대결"로 대체) |
| `scripts/verify-duel.ts`, `scripts/e2e-duel.ts`, `docs/duel.md` | 이 문서 |

## 단계

| # | 작업 | 산출물 |
|---|---|---|
| 1 | Upstash Redis 프로비저닝(`vercel integration add upstash`, CLI 최신화 필요), `vercel env pull`, `lib/store.ts`, 레이트리밋 | 로컬·프로덕션 env |
| 2 | 방 모델 + 7개 라우트 + SSE. `scripts/verify-room.ts`: fetch로 2인 시뮬(생성→참가→진행→완주→검증 실패 케이스) | 서버 완성 |
| 3 | `useRoom` + `useGame` 연동 + 시계 보정 + 부트 인텐트 | 두 탭에서 동기 플레이 |
| 4 | 로비 · 카운트다운 · 실시간 스트립 · 결과 · 재대결 · 끊김 배너 | UI 완성 |
| 5 | `/room/[id]` 랜딩 + OG, `/result/[code]` + OG | 공유 루프 |
| 6 | 고스트 제거, README·DESIGN 갱신, `scripts/e2e-room.ts`(Playwright 두 컨텍스트 동시 플레이) | 정리·검증 |
| 7 | 배포, 프로덕션 스모크(방 생성→참가→SSE 수신) | 라이브 |

규모: 신규 약 1,100줄, 삭제 약 600줄.

## 구현 메모 (스펙과 달라진 점)

- `finish` 라우트를 따로 두지 않았다. `progress`가 81칸 값을 통째로 받아 서버가 정답 칸을 계산하고, 전부 맞으면 그 자리에서 완주 처리한다. 정답 칸 인덱스를 클라이언트가 보내는 방식은 검증이 불가능해서 버렸다.
- 기권 규칙: 한쪽만 60초 이상 조용하고 상대는 살아 있을 때만 기권. 둘 다 조용하면 아무도 기권시키지 않고, 180초가 지나면 방을 폐기한다(처음 구현은 둘 다 끊겼을 때 순서상 먼저 검사되는 호스트가 임의로 기권되는 버그가 있었다 — `verify-room`이 잡음).
- 저장소: `KV_REST_API_*`(Vercel Upstash 통합) 또는 `UPSTASH_REDIS_REST_*`가 있으면 Redis, 없으면 인메모리. CAS는 Lua `EVAL`로, 인메모리는 단일 프로세스라 동기 비교로 충분.
- 진입: `/room/[id]` 랜딩의 CTA는 `<a href="/#room=ID">` 전체 내비게이션(홈 마운트 시점에 해시가 있어야 함). 재대결·로비 열기(`/#lobby`)도 같은 부트 인텐트 경로.
- 로비 진입은 헤더의 검 아이콘 버튼. 힌트 버튼은 대결 중 "힌트 없음"으로 비활성.
- 대결 판 기록은 자유 게임으로 히스토리에 남고(리캡·공유 가능), 잔디·스트릭에는 들어가지 않는다.
- E2E(`scripts/e2e-room.ts`): 두 브라우저 컨텍스트로 방 생성 → 참가 → 카운트다운 → 친구 마커 → 승/패 모달 → 결과 링크·OG → 재대결까지 확인.

## 리스크

- **SSE 300초 상한**: 재접속 설계로 흡수. 재접속 순간 1~2초 지연 가능.
- **Redis 커맨드 비용**: 폴링 간격으로 조절. 사용량 늘면 pub/sub 전환.
- **시계**: 클라 시계를 믿지 않고 서버 시각 기준으로만 계산. 네트워크 지연만큼(수십 ms) 카운트다운이 어긋날 수 있으나 판정에는 영향 없음.
- **모바일 백그라운드**: 앱 전환 시 SSE가 끊긴다 → 복귀 시 재접속·스냅샷으로 복구. 30초 이상 나가 있으면 상대에게 "끊김"으로 보임(의도된 동작).

## 자가 피드백 기록 (5회)

각 회차마다 코드를 다시 읽고 E2E로 실제 흐름을 돌려 결함과 UI/UX 개선점을 찾아 고쳤다. 점수는 10점 만점 자체 평가.

| 회차 | 찾은 것 | 조치 | 기능 | UX | 견고성 |
|---|---|---|---|---|---|
| 1 | 초대 링크 참가 실패 후 "홈으로"를 누르면 게임이 없어 빈 화면에 갇힘 · 친구 기권 뒤 내 완주가 409로 거부돼 기록이 안 남음 · 대결 중 스티커가 "자유" | 기본 게임 복구 · 기권 종료 방에서도 남은 사람의 완주 허용 · "대결" 스티커, 카드 헤더 "실시간 대결" · `e2e-room-edge` 추가 | 8 | 7 | 7 |
| 2 | 내가 먼저 완주하고 친구가 푸는 중일 때 공유 문구가 "친구가 중간에 나가서"로 오류 · SSE 280초 재접속 때 배너 깜빡임 · 끝난 방 링크가 "이미 시작된 대결"만 표시 | 기권/미완주 문구 분리 · 3초 이상 끊길 때만 배너 · 끝난 방 랜딩에 결과 카드 + 결과 링크 | 9 | 8 | 8 |
| 3 | 먼저 완주한 쪽 결과 카드에서 친구 칸이 "—"뿐 · 기권 승리 모달이 하단에 붙어 위가 빔 · Redis 경로가 실제로 검증되지 않음 | 친구 실시간 진행 "6 / 41칸" + "친구는 아직 푸는 중" · 모달 중앙 정렬 · 도커 Redis + Upstash 호환 프록시로 RedisStore(Lua CAS) 검증, 프로덕션 빌드에서 E2E | 9 | 9 | 9 |
| 4 | 대기 상태에서도 500ms 폴링해 Redis 낭비 · 기록 화면에서 대결 판이 자유 게임과 구분 안 됨 | 상태별 폴링(진행 500ms · 대기 1s · 종료 2s) · 히스토리에 "친구와 대결" + "대결 승/패/무" 스티커 | 9 | 9 | 9 |
| 5 | 전체 회귀: 타입·verify·빌드·엣지/메인/기존 E2E, 375×667 로비 레이아웃 | 이상 없음. 남은 과제 아래 기록 | 9 | 9 | 9 |

측정: 약 20초짜리 대결 한 판 = GET 102 · EVAL 19 · SET 21 (연결당 2 GET/s). 15분 대결이면 ~3,600 커맨드.

### 남은 과제

- **Upstash 프로비저닝**: Vercel CLI가 AI 에이전트의 약관 동의를 막는다(`Term acceptance cannot be performed by an AI agent`). 계정 소유자가 `https://vercel.com/<team>/~/integrations/accept-terms/upstash` 에서 동의한 뒤 `vercel integration add upstash/upstash-kv -m primaryRegion=apne1` 을 실행하면 env가 자동 주입된다. **Redis 없이 배포하면 인메모리 저장소로 떨어져 인스턴스 간 공유가 안 되므로 배포는 그 뒤에.**
- `app/page.tsx`가 커졌다(방 상태 머신 + 게임). 다음엔 `useDuelRoom` 훅으로 방 로직을 분리하는 게 좋다.
- SSE 폴링 → Redis pub/sub(TCP) 전환은 사용량이 늘면.
- 대결 종료 후 "홈으로"는 같은 난이도의 오늘 데일리로 돌아간다. 이미 깬 데일리면 다시 깔린다(기존 "한 판 더"와 같은 동작). 대결 전 게임을 기억해 복귀하는 편이 더 낫다.

### 로컬에서 Redis로 테스트

```bash
docker run -d --name srh-redis -p 6390:6379 redis:7-alpine
docker run -d --name srh -p 8079:80 -e SRH_MODE=env -e SRH_TOKEN=local_token \
  -e SRH_CONNECTION_STRING="redis://host.docker.internal:6390" hiett/serverless-redis-http:latest
UPSTASH_REDIS_REST_URL=http://localhost:8079 UPSTASH_REDIS_REST_TOKEN=local_token npx tsx scripts/verify-room.ts
```
