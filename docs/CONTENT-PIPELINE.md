# Agentic CMS — Content Pipeline v2

> 에이전트가 만들고, 사람이 터치하고, 에이전트가 기억한다.

## 파이프라인 흐름

```
Topics (고정 테마) → Ideas (구체 앵글) → Contents (마스터) → Variants (플랫폼별) → Postiz (발행)
```

## 각 단계

### 1. Topics — 고정 테마 (월 1회 수정)

콘텐츠의 상위 카테고리. 3~5개. 키워드 선점 전략과 직결.

| 필드 | 설명 |
|---|---|
| name | 테마명 (예: "에이전틱 워크플로우") |
| keywords[] | SEO/GEO 키워드 |
| intent | educate \| inspire \| convert \| engage |
| description | 에이전트 컨텍스트용 설명 |

**현재 등록된 토픽:**
- 에이전틱 워크플로우 (convert)
- AX 전환 (educate)
- AI 마케팅 자동화 (inspire)
- 1인 SaaS 빌딩 (inspire)
- Agentic CMS (convert)

**근거:** Justin Welsh — Topic은 고정 테마 20~30개, 거의 안 바뀜. Nicolas Cole — `Topic × Angle × Format = Content Idea`.

---

### 2. Ideas — 구체적 앵글 (매일 운영)

Topic 안의 구체적 인사이트/앵글. 에이전트가 자동 수집 + 사람이 직접 입력.

| 필드 | 설명 |
|---|---|
| raw_text | 아이디어 원문 |
| source | exa_trend, manual, competitor_scan 등 |
| topic_id | 어떤 테마에 속하는지 |
| angle | 사례 / How-to / 비교 / 반직관 등 |
| target_audience | 타겟 독자 |

**사용자 액션:**
1. 에이전트가 수집한 아이디어 리스트 확인
2. 직접 입력 (+ Topic 선택)
3. [→ Content 생성] 클릭 → 에이전트가 마스터 콘텐츠 작성 시작

---

### 3. Contents — 마스터 콘텐츠 (주 3~5회)

1 idea → 1 long-form 콘텐츠. 에이전트가 작성, 사람이 편집.

| 필드 | 설명 |
|---|---|
| title | 제목 |
| hook | 오프닝 훅 (사람이 가장 많이 수정하는 필드) |
| body_md | Markdown 본문 |
| core_message | 핵심 메시지 |
| cta | Call-to-Action (2번째로 많이 수정) |
| topic_id | 연결된 테마 |
| content_type | long_text \| short_text \| script \| thread |

**Human Touch (80/20 룰):**
- 🤖 AI 80% — 구조, 초안, 리서치
- 👤 사람 20% — Hook 재작성, 개인 경험 추가, CTA 조정, AI냄새 제거

**편집 우선순위 (실전 마케터 공통):**
1. Hook — 거의 항상 사람이 다시 씀
2. CTA — 현재 비즈니스 우선순위에 맞게
3. 개인 경험/수치 — 사람만 아는 것 추가
4. AI냄새 제거 — 빈말, 헤징 표현 삭제

**저장 시 자동 기록:**
- `revisions.delta` — 어떤 필드가 어떻게 바뀌었는지
- `revisions.actor_type` — `human`
- 에이전트가 `get_revisions`로 조회 → 다음 콘텐츠에 패턴 반영

---

### 4. Variants — 플랫폼별 변환

1 content → N variants. 플랫폼 × 포맷 조합별 자동 생성.

| 필드 | 설명 |
|---|---|
| content_id | 마스터 콘텐츠 FK |
| platform | instagram, linkedin, threads, tiktok, youtube, x |
| format | reel, carousel, single_post, article, thread, story, short |
| body_text | 해당 포맷에 맞게 변환된 텍스트 |
| hashtags[] | 해시태그 |
| character_count | 글자수 (플랫폼 제한 체크용) |
| platform_settings | jsonb — 플랫폼별 고유 설정 (Postiz DTO 패턴) |
| status | draft → ready → sent_to_postiz → published |

**플랫폼별 제약조건:**

| 플랫폼 | 포맷 | 제약 | 프롬프트 핵심 |
|---|---|---|---|
| Instagram | Reel | 15~60초, 세로, 자막 | hook 3초, 시각적 전환 5초 간격 |
| Instagram | Carousel | 최대 10장, 1080² | 슬라이드당 1문장, 마지막=CTA |
| Instagram | Post | 2,200자 | 스토리텔링, 해시태그 20~30개 |
| LinkedIn | Article | 1,300자 권장 | 전문가 톤, 데이터/수치 강조 |
| Threads | Post | 500자 | 대화체, 해시태그 없음, 공감 유도 |

**사용자 액션:**
1. 5개 variant 카드를 훑어보며 리뷰
2. [✎ 편집] — 플랫폼별 톤/이모지/길이 미세조정
3. [🤖 재생성] — 불만족 시 개별 variant만 재생성
4. Status: Ready로 변경
5. [→ Postiz로 전송]

---

### 5. Publish — Postiz 연동

Agentic CMS에서 직접 발행 안 함. Postiz API로 전송만.

```
Agentic CMS (variant: ready)
  ↓ API: POST /postiz/posts
Postiz (post: DRAFT)
  ↓ 사람이 스케줄/즉시 발행
Postiz → 채널 API (IG/LinkedIn/Threads)
  ↓ webhook/polling
Agentic CMS (publications 레코드 + metrics)
  ↓ 에이전트 분석
🧠 학습 → 다음 variant에 반영
```

**Postiz 연결 현황:**
- ✅ Threads, X, YouTube, Instagram
- ✅ LinkedIn (패치 필요)
- ⏳ TikTok (심사중)
- URL: postiz.agenticworkflows.club

---

## 피드백 루프

```
publications.metrics → 에이전트 분석
  → "LinkedIn 질문형 hook → engagement 3x"
  → 다음 variant 생성 시 반영

revisions.delta (actor_type=human) → 에이전트 분석
  → "사람이 항상 CTA를 부드럽게 수정"
  → 다음 content 생성 시 톤 조정
```

---

## 산출물 예시

1 idea에서 나오는 게시물:

| 단계 | 산출물 | 수량 |
|---|---|---|
| Topic | "에이전틱 워크플로우" (기존 테마) | — |
| Idea | "콘텐츠 생산량 5배 달성 사례" | 1 |
| Content | 마스터 롱폼 (2000자 + hook + CTA) | 1 |
| Variants | IG Reel / IG Carousel / IG Post / LinkedIn / Threads | 5+ |
| Publish | 각 variant → 채널 발행 | 5+ |

**사람 작업시간: 콘텐츠당 ~10분. 주 5개 = 주 50분.**

---

## 범위 외 (별도 모듈)

- ❌ 직접 발행 — Postiz가 담당
- ❌ 영상 생성/편집 — 추후 별도 모듈. 미디어 URL 첨부만
- ❌ 댓글/DM 관리 — Postiz 또는 별도 도구
- ❌ 분석 대시보드 — Postiz metrics + 추후 확장

---

## 참고한 프레임워크

- **Justin Welsh**: Content Matrix (Topic × Format), 리사이클 3~6개월
- **Nicolas Cole**: `Topic × Angle × Format = Content Idea`, AI 80% 구조 + 사람 20% 영혼
- **Gary Vee**: Pillar → Macro → Micro, "Cross-posting이 아니라 Contextualizing"
- **Hormozi 팀**: Hook A/B 테스트, 주 100+ 게시물

## 참고한 오픈소스

- **Postiz** (27.7K⭐): 플랫폼별 DTO 패턴 → `platform_settings jsonb`
- **Mixpost** (3K⭐): PostVersion 모델 → `variants` 테이블 구조
- **MagicSync** (38⭐): idea→topic→hook→script 파이프라인
- **content-machine**: 포맷별 Pydantic 스키마 (carousel=slides[], thread=tweets[])
- **Socials_CrewAI**: Intelligence→Approval→Generation 3단계
