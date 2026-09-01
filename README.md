# 스도쿠 — 매일 한 판

MZ 타겟 "키치 팝" 디자인(하이퍼블루 + 라임, 청키 보더, 하드 섀도, 스티커)의 데일리 스도쿠 웹앱. 기록을 예쁘게 SNS로 자랑할 수 있습니다.

디자인 시스템은 `DESIGN.md`와 `app/globals.css`(토큰·유틸리티)에 정의되어 있습니다. 컴포넌트는 시맨틱 토큰만 사용합니다.

## 실행

```bash
npm install
npm run dev        # http://localhost:3000
```

## 기능

- **오늘의 퍼즐**: KST 자정 기준 시드 고정 데일리 퍼즐 (난이도 4단계, 유일해 보장) + 자유 퍼즐
- **인터랙션**: 행/열/박스 완성 시 잉크 물결, 클리어 시 청자빛 웨이브 + 컨페티, 오답 shake, 숫자 pop-in
- **게임 도구**: 메모(연필) 모드, 되돌리기, 힌트 3회, 지우기, 숫자별 남은 개수, 키보드 입력(1–9, 방향키, N 메모, H 힌트, ⌘Z)
- **기록**: 난이도별 베스트, 완주율, 데일리 스트릭, 최근 20게임 (localStorage)
- **SNS 공유**
  - `/share/[code]` 공유 링크 — `next/og` 동적 OG 카드로 카톡/X/슬랙에서 예쁜 미리보기
  - Web Share API(모바일 공유 시트) / 클립보드 폴백
  - Wordle 스타일 이모지 텍스트
  - 공유 카드 PNG 저장(Canvas 렌더, 1080×1350)
- 라이트/다크 테마, 모바일 터치 최적화(safe-area 대응)

## 배포

Vercel에 그대로 배포 가능. 프로덕션에서는 OG 이미지 절대 URL을 위해 환경 변수를 설정하세요:

```
NEXT_PUBLIC_SITE_URL=https://your-domain.example
```

## 검증 스크립트

```bash
npx tsx scripts/verify-sudoku.ts   # 생성기 유일해 검증 (난이도별 25회)
npx tsx scripts/e2e-clear.ts       # 클리어 플로우 E2E (요: dev 서버 + Chrome)
```
