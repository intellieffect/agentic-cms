#!/usr/bin/env python3
"""
Reference Finder v2 — DB 학습 기반 유사 영상 탐색

기존 DB 레퍼런스를 분석 → 패턴 프로필 생성 → 같은 부류의 새 영상만 찾아서 추가.
매칭률을 높이는 게 아니라 "우리 레퍼런스와 같은 부류"를 정확히 찾는 것이 목표.

사용법:
  # 1. DB 프로필 생성 (기존 레퍼런스 분석)
  python scripts/find_references.py --build-profile

  # 2. 계정 기반 탐색 (DB 계정의 다른 릴스)
  python scripts/find_references.py --from-accounts --limit 5

  # 3. 해시태그 탐색 (DB 해시태그 기반)
  python scripts/find_references.py --from-hashtags --limit 5

  # 4. 전체 자동 (프로필 생성 + 계정 + 해시태그)
  python scripts/find_references.py --auto --limit 10 --do-import
"""
import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
import time
from collections import Counter
from pathlib import Path

import requests
import google.generativeai as genai

# ─── Config ───
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
BRXCE_API = os.environ.get("BRXCE_API", "http://localhost:8092")
MIN_LIKES = int(os.environ.get("MIN_LIKES", "50"))

PROFILE_CACHE = Path(__file__).parent / "reference_profile.json"
RESULTS_FILE = Path(__file__).parent / "reference_results.json"

INSTAGRAM_USERNAME = os.environ.get("IG_USERNAME", "")
INSTAGRAM_PASSWORD = os.environ.get("IG_PASSWORD", "")
IG_COOKIE_CACHE = Path(__file__).parent / ".ig_session.json"


# ═══════════════════════════════════════════════════════
# 1. DB 프로필 생성 — 기존 레퍼런스 패턴 분석
# ═══════════════════════════════════════════════════════

def _get_sb():
    """Supabase client."""
    sb_url = os.environ.get("SUPABASE_URL", "")
    sb_key = os.environ.get("SUPABASE_SERVICE_KEY", "")
    if not sb_url or not sb_key:
        # .env 파일에서 로드
        env_file = Path(__file__).parent.parent / ".env"
        if env_file.exists():
            for line in env_file.read_text().splitlines():
                if "=" in line and not line.startswith("#"):
                    k, v = line.split("=", 1)
                    os.environ[k.strip()] = v.strip()
            sb_url = os.environ.get("SUPABASE_URL", "")
            sb_key = os.environ.get("SUPABASE_SERVICE_KEY", "")
    from supabase import create_client
    return create_client(sb_url, sb_key)


def fetch_db_references():
    """DB에서 모든 레퍼런스 영상 가져오기."""
    sb = _get_sb()
    resp = sb.table("reference_videos").select(
        "id, account_id, platform, caption, duration_sec, like_count, "
        "comment_count, view_count, music_artist, music_title, style_tags"
    ).execute()
    return resp.data or []


def build_profile(videos: list[dict]) -> dict:
    """기존 레퍼런스를 분석하여 패턴 프로필 생성."""
    if not videos:
        return {"error": "DB에 레퍼런스가 없습니다"}

    # 통계 추출
    captions = [v.get("caption", "") for v in videos if v.get("caption")]
    durations = [v["duration_sec"] for v in videos if v.get("duration_sec")]
    accounts = Counter(v.get("account_id", "") for v in videos)
    
    # 해시태그 추출
    hashtags = Counter()
    for cap in captions:
        for tag in re.findall(r"#(\w+)", cap.lower()):
            hashtags[tag] += 1

    # 캡션 키워드 (해시태그 제외)
    keywords = Counter()
    stop_words = {"the", "a", "an", "is", "in", "to", "of", "and", "for", "with", "my", "i", "you", "it", "this", "that", "on", "at", "from"}
    for cap in captions:
        clean = re.sub(r"#\w+", "", cap.lower())
        for w in re.findall(r"\b[a-z]{3,}\b", clean):
            if w not in stop_words:
                keywords[w] += 1

    import statistics
    dur_stats = {
        "mean": round(statistics.mean(durations), 1) if durations else 0,
        "median": round(statistics.median(durations), 1) if durations else 0,
        "min": min(durations) if durations else 0,
        "max": max(durations) if durations else 0,
    }

    # Gemini로 프로필 요약 생성
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel("gemini-2.0-flash")

    sample_captions = captions[:20]
    top_hashtags = [f"#{h}" for h, _ in hashtags.most_common(15)]
    top_keywords = [w for w, _ in keywords.most_common(15)]

    profile_prompt = f"""다음은 우리 팀이 수집한 레퍼런스 영상 {len(videos)}개의 데이터입니다.
이 영상들의 **구체적인 공통 비주얼 패턴**을 분석해서 "레퍼런스 프로필"을 JSON으로 만들어주세요.

⚠️ 중요: 추상적/넓은 주제("기업가 정신", "동기부여" 등)가 아니라, 
이 영상들이 시각적으로 어떻게 생겼는지 구체적으로 설명해주세요.
예: "고층 오피스에서 노트북으로 코딩하는 모습", "도시 스카이라인이 보이는 창가 데스크" 등.

## 데이터
- 캡션 샘플 (최대 20개):
{json.dumps(sample_captions, ensure_ascii=False, indent=2)}

- 상위 해시태그: {', '.join(top_hashtags)}
- 상위 키워드: {', '.join(top_keywords)}
- 영상 길이: 평균 {dur_stats['mean']}초, 범위 {dur_stats['min']}~{dur_stats['max']}초
- 총 계정 수: {len(accounts)}개

## 응답 형식 (JSON만, 마크다운 없이):
{{
  "description": "이 컬렉션의 영상들이 시각적으로 어떻게 생겼는지 구체적 설명 (2-3줄). 추상적 주제가 아니라 화면에 보이는 것 위주로.",
  "must_have": ["이 컬렉션 영상에 반드시 있어야 하는 시각적 요소 3-5개 (매우 구체적으로)"],
  "visual_style": ["촬영 스타일/편집 특징 3-5개"],
  "content_patterns": ["콘텐츠 구조 패턴 3-5개"],
  "ideal_hashtags": ["탐색에 유용한 해시태그 10-15개 (# 없이)"],
  "duration_range": {{"min": 숫자, "max": 숫자}},
  "exclude_patterns": ["이 컬렉션에 절대 맞지 않는 것 5-8개 (구체적으로 — 예: 음식, 패션, 동물, 게임 등)"]
}}"""

    try:
        resp = model.generate_content(profile_prompt)
        text = resp.text.strip()
        text = re.sub(r"^```json\s*", "", text).rstrip("`").strip()
        gemini_profile = json.loads(text)
    except Exception as e:
        gemini_profile = {"error": str(e)}

    profile = {
        "total_videos": len(videos),
        "top_hashtags": dict(hashtags.most_common(20)),
        "top_keywords": dict(keywords.most_common(20)),
        "top_accounts": dict(accounts.most_common(20)),
        "duration_stats": dur_stats,
        "gemini_analysis": gemini_profile,
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
    }

    # 캐시 저장
    PROFILE_CACHE.write_text(json.dumps(profile, ensure_ascii=False, indent=2))
    return profile


def load_profile() -> dict | None:
    """캐시된 프로필 로드. 없으면 None."""
    if PROFILE_CACHE.exists():
        try:
            return json.loads(PROFILE_CACHE.read_text())
        except Exception:
            pass
    return None


def get_or_build_profile() -> dict:
    """프로필 로드 or 빌드."""
    profile = load_profile()
    if profile:
        return profile
    videos = fetch_db_references()
    return build_profile(videos)


# ═══════════════════════════════════════════════════════
# 2. Gemini 판별 — 프로필 기반
# ═══════════════════════════════════════════════════════

def build_judge_prompt(profile: dict) -> str:
    """DB 프로필 기반 Gemini 판별 프롬프트 생성."""
    ga = profile.get("gemini_analysis", {})
    description = ga.get("description", "오피스/데스크 셋업에서 작업하는 모습의 숏폼 영상")
    must_have = ga.get("must_have", [])
    visual_style = ga.get("visual_style", [])
    content_patterns = ga.get("content_patterns", [])
    exclude_patterns = ga.get("exclude_patterns", [])
    dur = profile.get("duration_stats", {})

    return f"""이 영상이 우리 레퍼런스 컬렉션에 들어갈 수 있는지 **엄격하게** 판별해주세요.
JSON으로만 답해주세요 (마크다운 코드블록 없이).

## 우리 레퍼런스 컬렉션 (구체적 기준)
{description}

필수 시각 요소 (이것들이 화면에 보여야 함): {', '.join(must_have)}
촬영/편집 스타일: {', '.join(visual_style)}
콘텐츠 패턴: {', '.join(content_patterns)}
영상 길이: 보통 {dur.get('min', 4)}~{dur.get('max', 60)}초

## 절대 불가 (하나라도 해당되면 match=false):
{', '.join(exclude_patterns)}

## 판별 기준 (0-10)
- visual_match: 필수 시각 요소가 화면에 실제로 보이는가? (가장 중요!)
- style_match: 촬영/편집 스타일이 비슷한가? (타임랩스, 숏폼, 미니멀 등)
- content_match: 콘텐츠 구조가 유사한가?
- overall: 종합 (visual_match에 가중치 50%)

## 응답 형식:
{{"visual_match": 0-10, "style_match": 0-10, "content_match": 0-10, "overall": 0-10, "match": true/false, "reason": "한줄 설명"}}

## ⚠️ 엄격한 기준:
- match=true: overall >= 8 이고 visual_match >= 7 (둘 다 충족해야 함)
- 주제가 비슷해도 화면에 보이는 것이 다르면 false
- "기업가 정신", "동기부여" 같은 넓은 주제 공유만으로는 부족 → 시각적으로 같은 종류여야 함
- 확신이 없으면 무조건 false. 잘못 넣는 것보다 안 넣는 게 100배 낫습니다."""


def analyze_video_with_profile(video_path: str, profile: dict, model, max_retries: int = 3) -> dict:
    """프로필 기반으로 영상 판별. 429 rate limit 시 자동 재시도."""
    for attempt in range(max_retries):
        try:
            vf = genai.upload_file(video_path)
            while vf.state.name == "PROCESSING":
                time.sleep(1)
                vf = genai.get_file(vf.name)

            prompt = build_judge_prompt(profile)
            resp = model.generate_content([vf, prompt])
            text = resp.text.strip()
            text = re.sub(r"^```json\s*", "", text).rstrip("`").strip()
            result = json.loads(text)
            if isinstance(result, list):
                result = result[0]
            try:
                genai.delete_file(vf.name)
            except Exception:
                pass
            return result
        except Exception as e:
            err_str = str(e)
            if "429" in err_str or "Resource exhausted" in err_str:
                wait = 5 * (attempt + 1)
                if attempt < max_retries - 1:
                    print(f"⏳ rate limit, {wait}s 대기...", end=" ", flush=True)
                    time.sleep(wait)
                    continue
            return {"error": err_str, "match": False}
    return {"error": "max retries exceeded", "match": False}


# ═══════════════════════════════════════════════════════
# 3. 영상 수집 — 계정 기반 + 해시태그 기반
# ═══════════════════════════════════════════════════════

def load_instagram_session():
    """인스타그램 로그인 세션."""
    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "X-IG-App-ID": "936619743392459",
    })

    # 캐시된 세션
    if IG_COOKIE_CACHE.exists():
        try:
            cached = json.loads(IG_COOKIE_CACHE.read_text())
            session.cookies.update(cached)
            r = session.get("https://www.instagram.com/api/v1/accounts/current_user/", timeout=5)
            if r.status_code == 200:
                print("🔑 캐시된 세션 사용")
                return session
        except Exception:
            pass

    # 로그인
    print(f"🔑 인스타그램 로그인 ({INSTAGRAM_USERNAME})...")
    try:
        session.get("https://www.instagram.com/accounts/login/", timeout=10)
        csrf = session.cookies.get("csrftoken", "")
        login_resp = session.post(
            "https://www.instagram.com/accounts/login/ajax/",
            data={
                "username": INSTAGRAM_USERNAME,
                "enc_password": f"#PWD_INSTAGRAM_BROWSER:0:{int(time.time())}:{INSTAGRAM_PASSWORD}",
                "queryParams": "{}",
                "optIntoOneTap": "false",
            },
            headers={
                "X-CSRFToken": csrf,
                "X-Requested-With": "XMLHttpRequest",
                "Referer": "https://www.instagram.com/accounts/login/",
            },
            timeout=10,
        )
        if login_resp.status_code == 200:
            data = login_resp.json()
            if data.get("authenticated"):
                print("   ✅ 로그인 성공")
                IG_COOKIE_CACHE.write_text(json.dumps(dict(session.cookies)))
                return session
            else:
                print(f"   ❌ 인증 실패: {data.get('message', '')}")
        else:
            print(f"   ❌ HTTP {login_resp.status_code}")
    except Exception as e:
        print(f"   ❌ 로그인 에러: {e}")

    # 폴백: 쿠키 파일
    cookie_file = Path(__file__).parent / ".ig_cookies.json"
    if cookie_file.exists():
        try:
            cached = json.loads(cookie_file.read_text())
            session.cookies.update(cached)
            print("   ✅ 쿠키 파일 로드")
            return session
        except Exception:
            pass

    print("   ❌ 모든 로그인 방법 실패")
    sys.exit(1)


def fetch_account_reels(session, account_id: str, limit: int = 12) -> list[dict]:
    """특정 계정의 최근 릴스 수집. clips API → feed API 폴백."""
    reels = []

    # Method 1: clips/user API
    try:
        resp = session.get(
            "https://www.instagram.com/api/v1/clips/user/",
            params={"target_user_id": account_id, "page_size": limit},
            timeout=10,
        )
        if resp.status_code == 200:
            data = resp.json()
            for item in data.get("items", []):
                media = item.get("media", {})
                code = media.get("code", "")
                dur = media.get("video_duration", 0)
                if not code or dur <= 0 or dur > 120:
                    continue
                likes = media.get("like_count", 0)
                caption_obj = media.get("caption") or {}
                caption = caption_obj.get("text", "")[:120] if isinstance(caption_obj, dict) else ""
                video_versions = media.get("video_versions", [])
                video_url = video_versions[0]["url"] if video_versions else ""
                reels.append({
                    "code": code, "account_id": account_id, "duration": dur,
                    "caption": caption, "video_url": video_url, "likes": likes, "source": "account",
                })
            if reels:
                return reels[:limit]
    except Exception:
        pass

    # Method 2: user feed API (폴백)
    try:
        resp = session.get(
            f"https://www.instagram.com/api/v1/feed/user/{account_id}/",
            params={"count": limit * 2},
            timeout=10,
        )
        if resp.status_code == 200:
            data = resp.json()
            for item in data.get("items", []):
                if item.get("media_type") != 2:  # video only
                    continue
                code = item.get("code", "")
                dur = item.get("video_duration", 0)
                if not code or dur <= 0 or dur > 120:
                    continue
                likes = item.get("like_count", 0)
                caption_obj = item.get("caption") or {}
                caption = caption_obj.get("text", "")[:120] if isinstance(caption_obj, dict) else ""
                video_versions = item.get("video_versions", [])
                video_url = video_versions[0]["url"] if video_versions else ""
                reels.append({
                    "code": code, "account_id": account_id, "duration": dur,
                    "caption": caption, "video_url": video_url, "likes": likes, "source": "account",
                })
    except Exception as e:
        print(f"   ⚠️ 계정 {account_id} 수집 에러: {e}")

    return reels[:limit]


def fetch_hashtag_reels(session, hashtag: str, limit: int = 10) -> list[dict]:
    """해시태그 기반 릴스 수집."""
    reels = []
    try:
        resp = session.get(
            f"https://www.instagram.com/api/v1/tags/web_info/?tag_name={hashtag}",
            timeout=10,
        )
        if resp.status_code != 200:
            return reels
        data = resp.json()

        for key in ["top", "recent"]:
            sections = data.get("data", {}).get(key, {}).get("sections", [])
            for section in sections:
                medias = section.get("layout_content", {}).get("medias", [])
                for m in medias:
                    node = m.get("media", {})
                    if node.get("media_type") != 2:
                        continue
                    code = node.get("code", "")
                    dur = node.get("video_duration", 0)
                    if not code or dur <= 0 or dur > 120:
                        continue
                    if any(r["code"] == code for r in reels):
                        continue
                    likes = node.get("like_count", 0)
                    if likes < MIN_LIKES:
                        continue
                    caption_obj = node.get("caption") or {}
                    caption = caption_obj.get("text", "")[:120] if isinstance(caption_obj, dict) else ""
                    video_versions = node.get("video_versions", [])
                    video_url = video_versions[0]["url"] if video_versions else ""

                    reels.append({
                        "code": code,
                        "duration": dur,
                        "caption": caption,
                        "video_url": video_url,
                        "likes": likes,
                        "hashtag": hashtag,
                        "source": "hashtag",
                    })
                    if len(reels) >= limit:
                        return reels
    except Exception as e:
        print(f"   ⚠️ #{hashtag} 에러: {e}")
    return reels


def download_and_trim(video_url: str, max_seconds: int = 8) -> str | None:
    """영상 다운로드 후 트림."""
    tmp_full = tempfile.mktemp(suffix=".mp4")
    tmp_trim = tempfile.mktemp(suffix=".mp4")
    try:
        r = requests.get(video_url, timeout=20)
        if r.status_code != 200 or len(r.content) < 1000:
            return None
        with open(tmp_full, "wb") as f:
            f.write(r.content)
        subprocess.run(
            ["ffmpeg", "-y", "-i", tmp_full, "-t", str(max_seconds), "-c", "copy", tmp_trim],
            capture_output=True, timeout=10,
        )
        os.remove(tmp_full)
        if os.path.exists(tmp_trim) and os.path.getsize(tmp_trim) > 1000:
            return tmp_trim
    except Exception:
        pass
    for f in [tmp_full, tmp_trim]:
        if os.path.exists(f):
            os.remove(f)
    return None


def import_reel(reel_code: str) -> str:
    """brxce-editor API로 릴스 임포트."""
    url = f"https://www.instagram.com/reel/{reel_code}/"
    try:
        r = requests.post(f"{BRXCE_API}/api/references/import", json={"url": url}, timeout=120)
        d = r.json()
        return d.get("id") or d.get("message") or d.get("error", "unknown")
    except Exception as e:
        return str(e)


# ═══════════════════════════════════════════════════════
# 4. 메인 탐색 로직
# ═══════════════════════════════════════════════════════

def discover(
    mode: str = "auto",
    limit: int = 10,
    do_import: bool = False,
    min_likes: int = 50,
) -> dict:
    """DB 학습 기반 레퍼런스 탐색.

    mode: 'auto' | 'accounts' | 'hashtags'
    Returns: {profile, candidates, matched, imported}
    """
    global MIN_LIKES
    MIN_LIKES = min_likes

    # 1. 프로필 로드/생성
    print("📊 레퍼런스 프로필 로드 중...")
    profile = get_or_build_profile()
    ga = profile.get("gemini_analysis", {})
    print(f"   ✅ 프로필: {ga.get('description', '?')[:60]}")
    print(f"   📁 DB 레퍼런스: {profile.get('total_videos', 0)}개")

    # 2. 기존 DB ID 목록 (중복 방지)
    existing_ids = set()
    try:
        db_videos = fetch_db_references()
        existing_ids = {v["id"] for v in db_videos}
    except Exception:
        pass

    # 3. 영상 수집
    session = load_instagram_session()
    all_reels = []

    if mode in ("auto", "accounts"):
        # 계정 기반: DB 상위 계정의 다른 릴스 탐색
        top_accounts = list(profile.get("top_accounts", {}).keys())[:10]
        print(f"\n👤 계정 기반 탐색 ({len(top_accounts)}개 계정)...")
        for acc_id in top_accounts:
            reels = fetch_account_reels(session, acc_id, limit=limit)
            # DB에 이미 있는 것 제외
            new_reels = [r for r in reels if r["code"] not in existing_ids]
            if new_reels:
                print(f"   @{acc_id}: {len(new_reels)}개 새 릴스")
            all_reels.extend(new_reels)
            time.sleep(1)

    if mode in ("auto", "hashtags"):
        # 해시태그 기반: 프로필에서 추출한 해시태그로 탐색
        ideal_tags = ga.get("ideal_hashtags", [])
        db_tags = list(profile.get("top_hashtags", {}).keys())[:5]
        search_tags = list(dict.fromkeys(ideal_tags[:10] + db_tags))[:15]
        print(f"\n#️⃣ 해시태그 탐색 ({len(search_tags)}개)...")
        for tag in search_tags:
            reels = fetch_hashtag_reels(session, tag, limit=max(3, limit // len(search_tags) + 1))
            new_reels = [r for r in reels if r["code"] not in existing_ids]
            if new_reels:
                print(f"   #{tag}: {len(new_reels)}개")
            all_reels.extend(new_reels)
            time.sleep(1)

    # 중복 제거
    seen = set()
    unique = []
    for r in all_reels:
        if r["code"] not in seen and r["code"] not in existing_ids:
            seen.add(r["code"])
            unique.append(r)

    print(f"\n📊 수집: {len(unique)}개 후보")
    if not unique:
        print("❌ 새로운 후보 없음")
        return {"profile": profile, "candidates": 0, "matched": [], "imported": []}

    # 4. Gemini 분석 (프로필 기반)
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel("gemini-2.0-flash")

    print(f"\n🤖 Gemini 분석 중...\n")
    results = []
    for i, reel in enumerate(unique):
        print(f"[{i + 1}/{len(unique)}] {reel['code']} ({reel['duration']:.0f}s, ❤️{reel['likes']})...", end=" ")

        if not reel.get("video_url"):
            print("❌ URL 없음")
            continue

        video_path = download_and_trim(reel["video_url"])
        if not video_path:
            print("❌ 다운로드 실패")
            continue

        result = analyze_video_with_profile(video_path, profile, model)
        os.remove(video_path)

        result["code"] = reel["code"]
        result["caption"] = reel.get("caption", "")
        result["likes"] = reel.get("likes", 0)
        result["source"] = reel.get("source", "")
        results.append(result)

        if result.get("error"):
            print(f"⚠️ {result['error'][:50]}")
        else:
            overall = result.get("overall", 0)
            is_match = result.get("match", False)
            icon = "✅" if is_match else "❌"
            print(f"{icon} overall={overall} theme={result.get('theme_match', 0)} visual={result.get('visual_match', 0)} ({result.get('reason', '')[:50]})")

        time.sleep(3)  # Gemini rate limit 방지

    # 5. 결과 정리
    matched = [r for r in results if r.get("match")]
    print(f"\n{'=' * 60}")
    print(f"📊 결과: {len(results)}개 분석, {len(matched)}개 매칭")
    print(f"{'=' * 60}")

    imported = []
    if matched:
        print(f"\n✅ 매칭된 레퍼런스:")
        for r in matched:
            print(f"  🎬 {r['code']} — overall={r.get('overall', 0)}")
            print(f"     https://www.instagram.com/reel/{r['code']}/")
            print(f"     {r.get('reason', '')}")

        if do_import:
            print(f"\n📥 {len(matched)}개 임포트 중...")
            for r in matched:
                result = import_reel(r["code"])
                print(f"  {r['code']} → {result}")
                imported.append({"code": r["code"], "result": result})
                time.sleep(2)
    else:
        print("\n🔍 조건에 맞는 새 레퍼런스 없음 (정상 — 없으면 안 넣는 게 맞음)")

    # 결과 저장
    RESULTS_FILE.write_text(json.dumps(results, ensure_ascii=False, indent=2))

    return {
        "profile": profile,
        "candidates": len(unique),
        "analyzed": len(results),
        "matched": matched,
        "imported": imported,
    }


# ═══════════════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description="DB 학습 기반 레퍼런스 자동 발굴 v2")
    parser.add_argument("--build-profile", action="store_true", help="DB 프로필 생성만")
    parser.add_argument("--from-accounts", action="store_true", help="계정 기반 탐색")
    parser.add_argument("--from-hashtags", action="store_true", help="해시태그 기반 탐색")
    parser.add_argument("--auto", action="store_true", help="전체 자동 (계정 + 해시태그)")
    parser.add_argument("--limit", type=int, default=10, help="계정/해시태그당 수집 수")
    parser.add_argument("--min-likes", type=int, default=50, help="최소 좋아요")
    parser.add_argument("--do-import", action="store_true", help="매칭된 릴스 DB 임포트")
    parser.add_argument("--refresh-profile", action="store_true", help="프로필 강제 재생성")
    args = parser.parse_args()

    if args.refresh_profile or args.build_profile:
        print("📊 프로필 생성 중...")
        videos = fetch_db_references()
        profile = build_profile(videos)
        ga = profile.get("gemini_analysis", {})
        print(f"\n✅ 프로필 생성 완료!")
        print(f"   설명: {ga.get('description', '?')}")
        print(f"   핵심 주제: {', '.join(ga.get('core_themes', []))}")
        print(f"   시각 스타일: {', '.join(ga.get('visual_style', []))}")
        print(f"   추천 해시태그: {', '.join(ga.get('ideal_hashtags', [])[:10])}")
        print(f"   제외 패턴: {', '.join(ga.get('exclude_patterns', []))}")
        print(f"\n   저장: {PROFILE_CACHE}")
        if args.build_profile:
            return

    mode = "auto"
    if args.from_accounts:
        mode = "accounts"
    elif args.from_hashtags:
        mode = "hashtags"

    if args.auto or args.from_accounts or args.from_hashtags:
        discover(
            mode=mode,
            limit=args.limit,
            do_import=args.do_import,
            min_likes=args.min_likes,
        )


if __name__ == "__main__":
    main()
