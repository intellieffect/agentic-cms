---
name: traffic-report
description: agentic-cms 트래픽 현황을 파악·비교·분석하고 이상 신호·전환 퍼널·히스토리까지 포함한 헤비 리포트를 대화창에 markdown으로 출력한다. `/traffic-report`, `/traffic` 호출 또는 "트래픽 어때", "트래픽 리포트", "트래픽 분석 보고", "analytics 보고" 같은 요청에 반응. dashboard API(localhost:3150)를 호출해 자체 analytics_events + GA4 + GSC 3소스를 병합한다.
---

# traffic-report — agentic-cms 트래픽 헤비 리포트

dashboard `/analytics/traffic` 가 제공하는 3소스(self `analytics_events` + GA4 + GSC) 데이터를 한 호출로 병렬 수집하고, 룰 기반 해석·이상 감지·행동 제안을 대화창 markdown 한 장으로 출력한다.

설계 원칙:
- 기존 `dashboard/src/app/api/analytics/*/route.ts` + `dashboard/src/lib/analytics/traffic.ts` 계산 로직을 **100% 재사용**. 이 스킬은 얇은 HTTP 클라이언트 + 해석 레이어.
- dashboard 서버 기동 전제. 미기동이면 기동 안내만 하고 종료 (자동 기동 금지).
- 파일 저장·옵시디언 반영 없음. 인라인 출력만.

## 인자 규약

| 호출 | 의미 |
|---|---|
| `/traffic-report` | 기본. preset=`7d` + today 스냅샷 + GA4·GSC(env 있으면) + 30d 히스토리 렌즈 |
| `/traffic-report 7d\|30d\|90d\|this_month\|last_month` | preset 지정 |
| `/traffic-report today` | 오늘 누적(KST) vs 어제 동시점까지 비교 |
| `/traffic-report --compare=none` | 비교 끔 (현재 값만) |
| `/traffic-report --skip=ga4,gsc` | 외부 소스 스킵 (GA4/GSC env 미설정 시 자동 스킵) |
| `/traffic-report --topn=N` | breakdown 상위 N (기본 10, API 상한 25) |

preset이 `30d`·`90d`·`this_month`·`last_month` 또는 `today`이면 **30일 히스토리 렌즈 섹션은 생략** (중복·의미 없음).

## Phase 0 — Preflight

아래를 순서대로 확인. 실패 시 Phase 1 진입 금지.

### 0-1. 포트 3150 LISTEN

```bash
lsof -iTCP:3150 -sTCP:LISTEN -n -P 2>/dev/null | grep LISTEN
```

출력 없으면 기동 안내 후 스킬 종료 (자동 기동 X):

> dashboard가 기동되지 않았습니다. 아래 명령으로 먼저 기동해 주세요.
>
> ```bash
> cd /Users/jinkihyeok/Projects/agentic-cms/dashboard && PORT=3150 npm run dev
> ```

### 0-2. 인자 파싱 · 기본값 확정

- preset: 기본 `7d`. `today`면 mode=today.
- compare: 기본 `previous`. `--compare=none`이면 `none`.
- topN: 기본 10. `--topn=N` 오면 1~25 clamp.
- skip 목록: `--skip=ga4,gsc` 쉼표 분리.

### 0-3. GA4 / GSC 기본 포함 · 500이면 자동 degrade

GA4·GSC는 **항상 호출 시도**. Phase 1에서 500/503 응답 오면 해당 섹션만 "[데이터 없음: env 미설정]"로 degrade (사용자에게 env.local 설정 안내 bullet 추가). `--skip=ga4` 또는 `--skip=gsc` 명시하면 호출 자체 생략.

dashboard가 살아있으면 Supabase 연결은 일반적으로 정상 (서버가 이미 env 로드 상태). main API가 500이면 그때 전체 중단 + 에러 메시지.

## Phase 1 — 병렬 수집

bash 단일 호출에 `&` + `wait` 패턴으로 fan-out. 각 curl은 30s timeout, `-o`로 임시 파일 저장, `-w`로 HTTP 코드 캡처.

```bash
BASE=http://localhost:3150
TMPDIR=$(mktemp -d)
PRESET={preset}
COMPARE={compare}
TOPN={topN}
DAYS={mapped_days}   # preset→days: 7d→7 / 30d→30 / 90d→90 / this_month·last_month→30 / today→7

# 주 데이터 (compare 또는 today)
if [ "$PRESET" = "today" ]; then
  URL_MAIN="$BASE/api/analytics/traffic?mode=today&topN=$TOPN"
else
  URL_MAIN="$BASE/api/analytics/traffic?mode=compare&preset=$PRESET&compare=$COMPARE&topN=$TOPN"
fi

curl -sS --max-time 30 -o "$TMPDIR/main.json" -w "%{http_code}" "$URL_MAIN" > "$TMPDIR/main.code" &

# today 스냅샷 (preset≠today일 때만, 리포트 상단에 "지금 이 순간" pulse로)
if [ "$PRESET" != "today" ]; then
  curl -sS --max-time 30 -o "$TMPDIR/today.json" -w "%{http_code}" "$BASE/api/analytics/traffic?mode=today&topN=$TOPN" > "$TMPDIR/today.code" &
fi

# 30d 히스토리 렌즈 (preset=7d 일 때만)
if [ "$PRESET" = "7d" ]; then
  curl -sS --max-time 30 -o "$TMPDIR/lens30.json" -w "%{http_code}" "$BASE/api/analytics/traffic?mode=compare&preset=30d&compare=previous&topN=$TOPN" > "$TMPDIR/lens30.code" &
fi

# GA4 (--skip=ga4 아닐 때만, 500이면 Phase 2에서 degrade)
if [ "$SKIP_GA4" != "1" ]; then
  curl -sS --max-time 30 -o "$TMPDIR/ga4.json" -w "%{http_code}" "$BASE/api/analytics/ga4?days=$DAYS" > "$TMPDIR/ga4.code" &
fi

# GSC (--skip=gsc 아닐 때만, 500이면 Phase 2에서 degrade)
if [ "$SKIP_GSC" != "1" ]; then
  curl -sS --max-time 30 -o "$TMPDIR/gsc.json" -w "%{http_code}" "$BASE/api/analytics/gsc?days=$DAYS" > "$TMPDIR/gsc.code" &
fi

wait
echo "tmpdir=$TMPDIR"
for f in main today lens30 ga4 gsc; do
  [ -f "$TMPDIR/$f.code" ] && echo "$f=$(cat $TMPDIR/$f.code)"
done
```

각 응답에 대해:
- HTTP 200: 정상 → Phase 2에서 JSON 파싱
- HTTP 4xx/5xx: 해당 섹션만 `[데이터 없음: HTTP {code}]` 로 degrade, 전체 중단 금지
- `.json` 읽기 실패 (파일 없음): env 미설정으로 skip된 섹션은 렌더링 자체 생략

`cat $TMPDIR/main.json | jq` 로 내용 확인 후 Phase 2.

## Phase 2 — 해석 · 이상 감지

`TrafficApiResponse` 스키마 (재사용 참조 — `dashboard/src/lib/analytics/traffic.ts`):

```
meta:
  mode: "compare" | "today"
  timezone: "Asia/Seoul"
  current:  { start, end, label, days }
  previous: { start, end, label, days } | null  (compare=none 시 null)
summary:
  sessions, visitors, conversions, conversionSessions: MetricComparison
  conversionRate, readRate: RateComparison   # 단위는 %
  pagesPerSession: MetricComparison
trends: [ CompareTrendPoint | TodayTrendPoint, ... ]
breakdown:
  pages:    [ { key, title, url, sessionsCurrent, sessionsPrevious, sessionsDelta,
                conversionsCurrent, conversionsPrevious, conversionsDelta,
                conversionRateCurrent, conversionRatePrevious } ]
  channels: [ { channel, sessionsCurrent, sessionsPrevious, sessionsDelta,
                conversionsCurrent, conversionsPrevious,
                conversionRateCurrent, conversionRatePrevious } ]
  sources:  [ { sourceKey, channel, sourceDomain, sourceLabel,
                sessionsCurrent, sessionsPrevious, sessionsDelta,
                conversionsCurrent, conversionsPrevious, conversionsDelta,
                conversionRateCurrent, conversionRatePrevious } ]
```

MetricComparison: `{ current, previous, delta, deltaPct }` — previous null이면 delta/deltaPct도 null.

### 2-1. 이상 신호 룰

아래 조건을 main 응답에 적용하여 Phase 3 "이상 신호" 섹션 bullet 생성. 순서대로 평가.

| 뱃지 | 신호 | 조건 |
|---|---|---|
| 🔴 | sessions 급락 | `summary.sessions.deltaPct != null && summary.sessions.deltaPct < -50` |
| 🟢 | sessions 급증 | `summary.sessions.deltaPct != null && summary.sessions.deltaPct > 100` |
| 🔴 | 전환 세션 0 경고 | `summary.conversionSessions.current == 0 && summary.conversionSessions.previous >= 3` — primary conversion 완전히 끊긴 상태 |
| 🔴 | 전환 세션 급락 | `summary.conversionSessions.deltaPct != null && summary.conversionSessions.deltaPct < -50 && summary.conversionSessions.current < 3` — 저볼륨 플래그(표본 N=current) 병기 |
| 🟡 | 전환 세션 표본 작음 | `summary.conversionSessions.current > 0 && summary.conversionSessions.current < 3` — 단독 알람 아님, 다른 신호에 "(표본 N={M}, 해석 유의)" 라벨 자동 부착 |
| 🔴 | readRate 급락 | `summary.readRate.deltaPct != null && summary.readRate.deltaPct < -30` |
| 🟡 | 신규 소스 Top5 | `breakdown.sources[0..4]` 중 `sessionsPrevious == 0 || sessionsPrevious == null` 인 항목 (소스명 나열) |
| 🟡 | Top 소스 교체 | previous 데이터를 `sessionsPrevious` 내림차순 재정렬한 1위 ≠ current `sessionsCurrent` 1위 (`sourceLabel` 비교) |
| 🔴 | 페이지 급락 | `breakdown.pages` 중 `sessionsPrevious >= 10 && (sessionsDelta / sessionsPrevious) < -0.5` (최대 3개까지 bullet) |
| 🟢 | GSC 기회 키워드 | **GSC 섹션 ON일 때만 평가** (env OFF면 룰 자체 skip — bullet 바구니에서 제외). GSC 응답의 `queries` 중 `position > 10 && impressions >= 1000` (최대 5개) |

**저볼륨 환경 원칙** (AWC 월 signup ~9건, v3 기준):
- 전환 세션 지표는 항상 **절대 건수 + Δ%** 병기. Δ%만으로 판단 금지
- 전환 세션 표본 < 3 이면 다른 이상 신호 bullet 끝에 "(표본 N={M}, 해석 유의)" 라벨 자동 부착
- v1("전환율 붕계 >=2%") 임계값은 v3 저볼륨과 맞지 않아 **폐기** — 2025년 주차엔 conversionRate=0.4% 수준이 정상

신호 0개면 bullet 하나: "- 정상 범위 내 (이상 신호 없음)".

### 2-2. Funnel Drop-off (v3, 2026-04-24부터)

**전환 정의 v3**: `sign_up` 이벤트 **only** (소스: `dashboard/src/lib/analytics/traffic.ts::isConversion`).

v1(newsletter + kakao)·v2(/my page_view 포함) 모두 폐기. v2는 page_view가 세션당 25+ 반복 발행되어 double count 구조적 함정 — Kaushik canonical · GA4 공식 · Intercom · Mixpanel · Piwik BP 3/3 합의로 "pageview는 intent 신호 아님". 과도기로 sign_up만 primary 유지. chat_first_message · meeting_booked 계측 완료 시 v4로 확장 (후속 ledger task).

**주의**: v1→v2→v3 정의 변경으로 과거 conversionRate 시계열 불연속. 직접 비교 금지.

**funnel drop-off 단계** (계측 현황 따라 단계별 표시):

1. **유입** — `summary.sessions.current`
2. **🟢 Activation (Signup)** — `summary.conversionSessions.current` (v3 = sign_up 세션)
3. **⏳ Chat Engaged** — `chat_first_message` 세션 수. **[계측 대기 · ledger t_fbc66a1 p1]**
4. **⏳ Meeting Booked** — `meeting_booked` 세션 수. **[계측 대기 · ledger 신규 task]**
5. **(Macro) Contract** — Bruce 수기 입력. **[ledger 외부 또는 CRM]**

각 단계 drop-off %p = (이전 단계 세션 - 현재 단계 세션) / 이전 단계 세션 × 100. 미계측 단계는 "(계측 대기)" 표기하고 0으로 가정하지 말 것.

ReadRate(scroll_depth ≥75%)는 conversion 아닌 **engagement 신호** — 별도 섹션(2-2b 아래)에서만 사용. funnel에는 섞지 않음.

### 2-2a. 해석 원칙

- **signup 세션 < 5 이면** "표본 작음 — 직접 % 해석 금지, 절대 건수로 판단"
- **signup 절대 건수 Δ가 2 이상** 이면 유의미한 움직임으로 hint
- **/my 진입 세션**은 engagement 신호로 breakdown에서만 언급. conversion 지표에 포함 금지
- **funnel drop-off 해석**: 가장 급격한 drop 단계가 1차 개선 타겟. 예: 유입 500 → signup 5 (1%) → chat [대기] → meeting [대기] → 유입→signup drop 99% = signup friction이 최대 병목

### 2-2b. Low-volume 경고 (필수)

AWC는 월 signup ~9건 · 계약 월 0~2건 저볼륨 환경 (HubSpot·CXL 공식 기준 "1000 세션 미만은 통계적 유의성 샘플 아님").

- **N < 30 (주간 세션 수)** 인 단계는 Δ% 뒤에 "(표본 N={M}, 해석 유의)" 라벨 자동 부착
- **단일 주간 변동** 은 noise 가능성 높음 — **2-3주 지속 추세**를 트리거로 해석
- `readRate`·`pagesPerSession` 같은 engagement 지표는 N이 충분해도 conversion funnel과 분리 해석

### 2-3. 채널 기여도

`breakdown.channels` 에서 `sum = Σ sessionsCurrent`. 각 채널 기여% = `sessionsCurrent / sum × 100`, 1 decimal.

### 2-4. GA4 해석 (있으면)

- overview: 5개 카드
- 커스텀 이벤트 top 5 (`events` 배열, count desc 이미 정렬됨)
- CTA 클릭 top 5 (`ctaClicks`)
- 전환 퍼널 (`conversions`): newsletter rate, booking rate, signups, logins

### 2-5. GSC 해석 (있으면)

- overview 4개 카드 (총 클릭·노출·CTR·평균 순위)
- queries top 10
- pages top 10
- 기회 키워드 = 2-1 룰 적용 결과 재사용

### 2-6. 30일 렌즈 (preset=7d 일 때만)

lens30 응답의 `summary.sessions.deltaPct` 와 main(`7d`)의 `summary.sessions.deltaPct` 비교:
- 둘 다 양수 & main > lens30 → "7일 추세가 30일 평균보다 가속"
- 둘 다 음수 & main < lens30 → "7일 감소폭이 30일 대비 악화"
- 부호 반대 → "7일이 30일 추세와 반전"
- 부호 같고 차이 10%p 이내 → "30일 추세와 일관"

## Phase 3 — Markdown 리포트

아래 템플릿을 **순서대로** 대화창에 출력. 각 섹션 미데이터는 `[데이터 없음: {reason}]` 한 줄로 대체.

```markdown
# 📊 Traffic Report — {mode label} ({meta.current.label})

## TL;DR
- {지표 중 변화 가장 큰 항목 1줄, deltaPct와 함께}
- {breakdown에서 주목할 항목 1줄 — top mover 또는 신규 Top5 소스}
- {이상 신호 중 🔴 중 첫째 또는 "리스크 없음" 1줄}

## 핵심 지표 (현재 vs 이전)
현재: {meta.current.label}
이전: {meta.previous.label | "—"}

| 지표 | 현재 | 이전 | Δ | Δ% |
|---|---:|---:|---:|---:|
| Sessions | {s.c} | {s.p} | {s.d:+} | {s.dp:+.1f}% |
| Visitors | ... | ... | ... | ... |
| Conversions | ... | ... | ... | ... |
| 전환율 | {c.c}% | {c.p}% | {c.d:+.1f}%p | {c.dp:+.1f}% |
| ReadRate | ... | ... | ... | ... |
| Pages/Session | ... | ... | ... | ... |

(이전 null이면 해당 셀 "—")

## Funnel Drop-off (v3)

| 단계 | 세션 수 | vs 이전 단계 | Δ% vs 이전 기간 | 계측 상태 |
|---|---:|---:|---:|:-:|
| 1. 유입 | {sessions.current} | — | {sessions.dp:+.1f}% {표본 경고} | ✅ |
| 2. Signup (Activation) | {conversionSessions.current} | {drop1:.1f}% drop | {csess.dp:+.1f}% {표본 경고} | ✅ |
| 3. Chat Engaged | — | — | — | ⏳ 계측 대기 |
| 4. Meeting Booked | — | — | — | ⏳ 계측 대기 |
| 5. Contract (Macro) | — | — | — | 📝 수기 (Bruce) |

- **주요 drop**: {단계 N → N+1 중 drop%p 최대인 것 한 줄 해석}
- **표본 경고**: 단계별 세션 수 < 30일 때 "(N={M}, 해석 유의)" 라벨 병기
- **engagement (별도 신호, conversion 아님)**: ReadRate {readRate.current:.1f}% · Pages/Session {pps.current:.1f}

## 전환 정의 변경 이력
- v1 (~2026-04-24): newsletter_submit ∪ outbound_click(open.kakao) — kakao·newsletter 폐기로 drift
- v2 (2026-04-24): sign_up ∪ /my page_view — page_view 세션당 25+ double count 함정 발견, 폐기
- **v3 (현재)**: sign_up only. 후속 chat_first_message·meeting_booked 계측 완료 시 v4 예정

## 이상 신호
- {2-1 룰 bullet들}

## Top 페이지
| # | Page | Sessions (Δ%) | Conv (Δ) | 전환율 |
|---:|---|---:|---:|---:|
(상위 topN. title 우선, 없으면 url)

## Top 채널
| 채널 | Sessions (Δ%) | 전환율 | 기여도 |
|---|---:|---:|---:|
(직접·검색·SNS·레퍼럴 순, 있는 것만)

## Top 소스
| # | Source | Channel | Sessions (Δ%) | Conv | 신규? |
|---:|---|---|---:|---:|:-:|
(신규 = sessionsPrevious==0 → ✅)

## GA4 (있으면)
- **Overview** — PV {pv} · Users {u} · Sessions {s} · 이탈률 {br:.1%} · 평균 세션 {asd}s
- **커스텀 이벤트 Top 5**: {eventName: count} × 5
- **CTA 클릭 Top 5**: {ctaId: count} × 5
- **전환 퍼널**
  - 뉴스레터: 뷰 {fv} → 제출 {sub} ({rate:.1%})
  - 부킹: 뷰 {pv} → 제출 {sub} → 완료 {cmp} ({rate:.1%})
  - 회원가입 {signups} · 로그인 {logins}

## Search Console (있으면)
- **Overview** — 클릭 {c} · 노출 {i} · CTR {ctr:.1%} · 평균 순위 {pos:.1f}
- **Top Queries 10**
  | # | Query | Clicks | Impr | CTR | 순위 |
- **Top Pages 10**
  (동일 형식)
- **🟢 기회 키워드** (position>10 & impressions≥1000, 최대 5개)
  - "{query}" — 순위 {pos:.1f}, 노출 {imp}, 클릭 {c}

## 30일 렌즈 (preset=7d 일 때만)
- 30일 sessions Δ% = {lens30.dp:+.1f}%
- 7일 sessions Δ% = {main.dp:+.1f}%
- 해석: {2-6 룰 문장}

## 🎯 제안
- {이상 신호별 대응 제안}
- {GSC 기회 키워드 있으면: 콘텐츠 기획 제안}
- {breakdown 상위 움직임 기반 제안}

신호 없고 움직임 평이하면: "- 이번 기간 특이점 없음. 기존 운영 지속 권장."

## Meta
- 타임존: Asia/Seoul (KST)
- 현재 range: {meta.current.start} – {meta.current.end}
- 이전 range: {meta.previous.start} – {meta.previous.end} (또는 "—")
- 데이터 소스: self(analytics_events) + GA4({ON|OFF}) + GSC({ON|OFF})
- 호출 시각: {now ISO}
- topN: {topN}
```

### 렌더링 주의사항

- 숫자 천단위: `Intl.NumberFormat`/`.toLocaleString()` 스타일 (콤마)
- 퍼센트: `.toFixed(1)` (소수점 1자리)
- Δ 부호: 양수 `+`, 음수 `-`, 0은 `±0`
- previous=null (compare=none) 시 해당 열 `—` 로 표시, deltaPct 열 생략 가능
- 소스 라벨은 `sourceLabel` 그대로 사용 (Threads·X·LinkedIn·Facebook·Instagram·Google·Naver·Bing·Daum·Yahoo·Direct·unknown-referrer 또는 도메인)
- 채널은 한글 그대로: `직접`·`검색`·`SNS`·`레퍼럴`
- 표가 비어있으면 `(데이터 없음)` 한 줄로 치환

## Phase 4 — 종료

Phase 3 markdown을 대화창에 그대로 출력하고 스킬 종료. 저장·옵시디언 반영 없음.

사용자가 "저장해줘"·"옵시디언에"·"파일로" 등 명시하면 그때 별도 처리.

## 사용 예시

### 1. 기본 호출 (주간 리뷰)

```
/traffic-report
```

→ 7d compare + today 스냅샷 + 30d 렌즈 + GA4·GSC(있으면) + 전체 섹션. 주간 리뷰 포맷.

### 2. 오늘 현황 스냅샷

```
/traffic-report today
```

→ 오늘 누적(KST) vs 어제 동시점까지. 시간별 누적 trend. 30d 렌즈 생략.

### 3. 월간 내부 전용 리뷰 (외부 소스 스킵)

```
/traffic-report last_month --skip=ga4,gsc --topn=25
```

→ 지난 달 전체 범위, 내부 이벤트만, breakdown top 25.

## 제약 사항

- **dashboard 서버 기동 전제** — Phase 0-1에서 확인, 미기동이면 안내 후 종료
- **custom 날짜 range 미지원** — API가 preset만 받음. custom range 필요하면 preset 확장 후 서버 재배포
- **preset=today는 30d 렌즈 없음** — 하루 스냅샷에 30d 비교는 의미 없음
- **GA4 property·GSC site 하드코딩** — `ga4/route.ts` PROPERTY_ID=530816613 / `gsc/route.ts` NEXT_PUBLIC_(GSC_)SITE_URL env
- **`requireAnalyticsAdmin` 실질 인증 없음** — 로컬 전용. 프로덕션 배포 시 auth 가드 보강 필요 (스킬 scope 밖)
- **이상 감지 룰은 상수** — 튜닝하려면 이 파일 본문 직접 수정
