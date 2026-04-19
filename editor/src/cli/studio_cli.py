#!/usr/bin/env python3
"""
BrxceStudio Video Editor CLI — 에이전트용 인터페이스

에이전트(뽀뽀탄, 글쟁이 등)가 영상 편집 서버를 프로그래매틱하게 제어할 수 있는 CLI.
서버(server.py)가 localhost:8090에서 실행 중이어야 합니다.

사용법:
  python3 studio_cli.py <command> [options]

Commands:
  status          서버 상태 확인
  list-videos     사용 가능한 영상 소스 목록
  list-projects   저장된 프로젝트 목록
  load-project    프로젝트 로드
  create-project  새 프로젝트 생성 (JSON으로)
  analyze         영상 자동 분석 (장면감지 + 클립추출)
  analyze-status  분석 상태 확인
  render          프로젝트 렌더링 시작
  render-status   렌더링 상태 확인
  quick-edit      원스텝: 영상 → 분석 → 자막 → 프로젝트 생성 → 렌더링
  list-fonts      사용 가능한 폰트 목록
  link-source     소스 영상을 video-editor에 심볼릭 링크

Examples:
  # 서버 상태 확인
  python3 studio_cli.py status

  # 사용 가능한 영상 목록
  python3 studio_cli.py list-videos

  # 영상 분석 시작
  python3 studio_cli.py analyze --files IMG_0007.MOV IMG_0013.MOV --duration 30

  # 분석 결과로 프로젝트 생성
  python3 studio_cli.py create-project --name "하비와의 하루" --from-analyze

  # 프로젝트에 자막 추가
  python3 studio_cli.py add-subs --project PROJECT_ID --subs subs.json

  # 렌더링
  python3 studio_cli.py render --project PROJECT_ID

  # 원스텝 자동 편집
  python3 studio_cli.py quick-edit \\
    --files IMG_0007.MOV IMG_0013.MOV \\
    --name "오피스 릴스" \\
    --duration 30 \\
    --sub-mode context \\
    --context "개발자 일상 브이로그, 감성적인 톤"

  # 외부 영상 링크
  python3 studio_cli.py link-source /Volumes/Media/Videos/trip.MOV
"""

import argparse
import base64
import glob as glob_mod
import json
import os
import random
import subprocess
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

SERVER = os.environ.get("BRXCE_EDITOR_URL", "http://localhost:8090")
BASE = Path(__file__).resolve().parent.parent / "editor"
PROJECTS_DIR = BASE / "_projects"
FONTS_DIR = BASE.parent.parent / "assets" / "fonts"


def api_get(path):
    """GET request to editor server."""
    try:
        req = urllib.request.Request(f"{SERVER}{path}")
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read())
    except urllib.error.URLError as e:
        print(f"❌ 서버 연결 실패: {e}", file=sys.stderr)
        print(f"   서버가 실행 중인지 확인하세요: python3 server.py", file=sys.stderr)
        sys.exit(1)


def api_post(path, data):
    """POST request to editor server."""
    try:
        body = json.dumps(data).encode()
        req = urllib.request.Request(
            f"{SERVER}{path}",
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=300) as resp:
            return json.loads(resp.read())
    except urllib.error.URLError as e:
        print(f"❌ 서버 연결 실패: {e}", file=sys.stderr)
        sys.exit(1)


def cmd_status(_args):
    """서버 상태 확인."""
    result = api_get("/api/render/status")
    print(json.dumps(result, indent=2, ensure_ascii=False))


def cmd_list_videos(_args):
    """사용 가능한 영상 소스 목록."""
    result = api_get("/api/list-videos")
    videos = result.get("videos", [])
    if not videos:
        print("영상 없음")
        return
    print(f"📹 총 {len(videos)}개 영상:")
    for v in videos:
        name = v.get("name", "?")
        dur = v.get("duration", 0)
        res = v.get("resolution", "?")
        size_mb = v.get("size", 0) / 1024 / 1024
        landscape = "🖥️" if v.get("landscape") else "📱"
        print(f"  {landscape} {name}  ({dur:.1f}s, {res}, {size_mb:.1f}MB)")


def cmd_list_projects(_args):
    """저장된 프로젝트 목록."""
    result = api_get("/api/projects")
    projects = result.get("projects", [])
    if not projects:
        print("프로젝트 없음")
        return
    print(f"📁 총 {len(projects)}개 프로젝트:")
    for p in projects:
        pid = p.get("id", "?")
        name = p.get("name", "(이름없음)")
        clips = p.get("clipCount", 0)
        print(f"  [{pid}] {name} ({clips} clips)")


def cmd_load_project(args):
    """프로젝트 로드."""
    result = api_get(f"/api/projects/load/{args.project_id}")
    if args.json:
        print(json.dumps(result, indent=2, ensure_ascii=False))
    else:
        name = result.get("name", "(이름없음)")
        clips = result.get("clips", [])
        subs = result.get("subs", [])
        print(f"📁 {name}")
        print(f"   클립: {len(clips)}개")
        print(f"   자막: {len(subs)}개")
        for i, c in enumerate(clips):
            src = c.get("source", "?")
            start = c.get("start", 0)
            end = c.get("end", 0)
            sub = subs[i] if i < len(subs) else ""
            sub_preview = f' 💬 "{sub[:30]}..."' if sub else ""
            print(f"   [{i}] {src} {start:.1f}s→{end:.1f}s{sub_preview}")


def cmd_create_project(args):
    """새 프로젝트 생성."""
    if args.from_file:
        with open(args.from_file) as f:
            project = json.load(f)
    elif args.from_analyze:
        # 분석 결과에서 프로젝트 생성
        status = api_get("/api/analyze/status")
        if status.get("state") != "done":
            print(f"❌ 분석이 완료되지 않았습니다. 상태: {status.get('state')}", file=sys.stderr)
            sys.exit(1)
        result = status["result"]
        clips = result["clips"]
        subs = result.get("subs", [""] * len(clips))
        
        project = {
            "name": args.name or "자동 생성 프로젝트",
            "clips": clips,
            "subs": subs,
            "clipMeta": [{"speed": 1, "transition": "none", "transDur": 0.3} for _ in clips],
            "sources": list(set(c["source"] for c in clips)),
        }
    elif args.clips_json:
        clips = json.loads(args.clips_json)
        project = {
            "name": args.name or "CLI 프로젝트",
            "clips": clips,
            "subs": [""] * len(clips),
            "clipMeta": [{"speed": 1, "transition": "none", "transDur": 0.3} for _ in clips],
            "sources": list(set(c["source"] for c in clips)),
        }
    else:
        print("❌ --from-file, --from-analyze, 또는 --clips-json 중 하나 필요", file=sys.stderr)
        sys.exit(1)
    
    if args.name:
        project["name"] = args.name
    
    result = api_post("/api/projects/save", project)
    pid = result.get("id", "?")
    print(f"✅ 프로젝트 생성: {pid}")
    print(f"   스튜디오에서 열기: http://localhost:3200/studio/video-edit")
    return pid


def cmd_add_subs(args):
    """프로젝트에 자막 추가/수정."""
    project = api_get(f"/api/projects/load/{args.project_id}")
    
    if args.subs_file:
        with open(args.subs_file) as f:
            subs_data = json.load(f)
    elif args.subs_json:
        subs_data = json.loads(args.subs_json)
    else:
        print("❌ --subs-file 또는 --subs-json 필요", file=sys.stderr)
        sys.exit(1)
    
    # subs_data can be:
    # 1. Simple list of strings: ["자막1", "자막2", ...]
    # 2. List of objects with timing: [{"text": "...", "start": 0, "end": 5, "style": {...}}, ...]
    
    if isinstance(subs_data, list):
        if all(isinstance(s, str) for s in subs_data):
            # Simple string list → map to clips
            project["subs"] = subs_data
        else:
            # Global subs with timing
            project["globalSubs"] = subs_data
    
    # Apply subtitle style if provided
    if args.font or args.size or args.color or args.line_height or args.text_align:
        style = {}
        if args.font:
            style["font"] = args.font
        if args.size:
            style["size"] = args.size
        if args.color:
            style["color"] = args.color
        if args.line_height:
            style["lineHeight"] = args.line_height
        if args.text_align:
            style["textAlign"] = args.text_align
        if args.bg is not None:
            style["bg"] = args.bg
        if args.bg_color:
            style["bgColor"] = args.bg_color
        if args.bg_alpha is not None:
            style["bgAlpha"] = args.bg_alpha
        if args.stroke:
            style["stroke"] = True
            if args.stroke_color:
                style["strokeColor"] = args.stroke_color
            if args.stroke_width:
                style["strokeWidth"] = args.stroke_width
        if args.x is not None:
            style["x"] = args.x
        if args.y is not None:
            style["y"] = args.y
        if args.box_width is not None:
            style["boxWidth"] = args.box_width
        
        # Apply style to global subs
        if "globalSubs" in project:
            for sub in project["globalSubs"]:
                if isinstance(sub, dict):
                    sub.setdefault("style", {}).update(style)
        
        # Also store as default style
        project["defaultSubStyle"] = style
    
    result = api_post("/api/projects/save", project)
    print(f"✅ 자막 적용 완료: {result.get('id')}")


def cmd_analyze(args):
    """영상 분석 시작."""
    options = {
        "duration": args.duration,
        "clipMin": args.clip_min,
        "clipMax": args.clip_max,
        "subMode": args.sub_mode or "none",
        "context": args.context or "",
        "subLang": args.sub_lang or "ko",
    }
    body = {
        "files": args.files,
        "options": options,
    }
    result = api_post("/api/analyze", body)
    print(f"🔍 분석 시작됨")
    
    if args.wait:
        print("   진행 상황:", end="", flush=True)
        while True:
            time.sleep(2)
            status = api_get("/api/analyze/status")
            state = status.get("state", "idle")
            progress = status.get("progress", "")
            if state == "done":
                result = status.get("result", {})
                clips = result.get("clips", [])
                subs = result.get("subs", [])
                print(f"\n✅ 분석 완료: {len(clips)}개 클립")
                for i, c in enumerate(clips):
                    sub = subs[i] if i < len(subs) else ""
                    sub_str = f'  💬 "{sub[:40]}"' if sub else ""
                    print(f"   [{i}] {c['source']} {c['start']:.1f}→{c['end']:.1f}s{sub_str}")
                break
            elif state == "error":
                print(f"\n❌ 분석 실패: {status.get('error')}", file=sys.stderr)
                sys.exit(1)
            else:
                print(f"\r   {progress}       ", end="", flush=True)


def cmd_analyze_status(_args):
    """분석 상태 확인."""
    result = api_get("/api/analyze/status")
    state = result.get("state", "idle")
    if state == "done":
        clips = result["result"]["clips"]
        subs = result["result"].get("subs", [])
        print(f"✅ 분석 완료: {len(clips)}개 클립")
        for i, c in enumerate(clips):
            sub = subs[i] if i < len(subs) else ""
            sub_str = f'  💬 "{sub[:40]}"' if sub else ""
            print(f"   [{i}] {c['source']} {c['start']:.1f}→{c['end']:.1f}s{sub_str}")
    elif state == "error":
        print(f"❌ 분석 실패: {result.get('error')}")
    else:
        print(f"🔍 상태: {state} — {result.get('progress', '')}")


def cmd_render(args):
    """프로젝트 렌더링."""
    project = api_get(f"/api/projects/load/{args.project_id}")
    clips = project.get("clips", [])
    subs = project.get("subs", [])
    global_subs = project.get("globalSubs", [])
    clip_meta = project.get("clipMeta", [])
    clip_crops = project.get("clipCrops", [])
    clip_zooms = project.get("clipZooms", [])
    global_kb = project.get("globalKB", [])
    
    # Build render payload
    render_clips = []
    for i, c in enumerate(clips):
        meta = clip_meta[i] if i < len(clip_meta) else {}
        crop = clip_crops[i] if i < len(clip_crops) else {"x": 0, "y": 0, "w": 100, "h": 100}
        zoom = clip_zooms[i] if i < len(clip_zooms) else {"scale": 1, "panX": 0, "panY": 0}
        sub_text = subs[i] if i < len(subs) else ""
        sub_style = None
        if "subStyles" in project and i < len(project["subStyles"]):
            sub_style = project["subStyles"][i]
        
        clip_effects = project.get("clipEffects", [])
        effects = clip_effects[i] if i < len(clip_effects) else []
        
        render_clip = {
            "source": c["source"],
            "start": c["start"],
            "end": c["end"],
            "speed": meta.get("speed", 1),
            "crop": crop,
            "zoom": zoom,
            "effects": effects,
        }
        if sub_text:
            render_clip["subtitle"] = sub_text
            if sub_style:
                render_clip["subStyle"] = sub_style
        render_clips.append(render_clip)
    
    global_effects = project.get("globalEffects", [])
    
    render_data = {
        "clips": render_clips,
        "fps": args.fps or 30,
        "maxDuration": args.max_duration or 0,
        "subtitlesEnabled": not args.no_subs,
        "globalEffects": global_effects,
    }
    
    if args.output_name:
        render_data["outputName"] = args.output_name
    
    if global_subs:
        render_data["globalSubs"] = global_subs
    if global_kb:
        render_data["globalKB"] = global_kb
    
    # 전환효과
    transitions = project.get("transitions", [])
    if transitions:
        render_data["transitions"] = transitions
    
    # 페이드인/아웃
    fade_in_out = project.get("fadeInOut", {})
    fade_in = fade_in_out.get("fadeIn", {})
    fade_out = fade_in_out.get("fadeOut", {})
    if args.fade_in:
        render_data["fadeIn"] = {"enabled": True, "duration": args.fade_in}
    elif fade_in.get("enabled"):
        render_data["fadeIn"] = fade_in
    if args.fade_out:
        render_data["fadeOut"] = {"enabled": True, "duration": args.fade_out}
    elif fade_out.get("enabled"):
        render_data["fadeOut"] = fade_out
    
    result = api_post("/api/render", render_data)
    print(f"🎬 렌더링 시작됨: {len(render_clips)}개 클립")
    
    if args.wait:
        while True:
            time.sleep(3)
            status = api_get("/api/render/status")
            state = status.get("state", "idle")
            if state == "done":
                output = status.get("output", "")
                print(f"\n✅ 렌더링 완료: {output}")
                break
            elif state == "error":
                print(f"\n❌ 렌더링 실패: {status.get('error')}", file=sys.stderr)
                sys.exit(1)
            else:
                progress = status.get("progress", 0)
                total = status.get("total", 0)
                print(f"\r   🔄 {progress}/{total} 클립 처리 중...    ", end="", flush=True)


def cmd_render_status(_args):
    """렌더링 상태 확인."""
    result = api_get("/api/render/status")
    state = result.get("state", "idle")
    if state == "done":
        print(f"✅ 렌더링 완료: {result.get('output', '')}")
    elif state == "error":
        print(f"❌ 렌더링 실패: {result.get('error')}")
    elif state == "rendering":
        print(f"🔄 렌더링 중: {result.get('progress', 0)}/{result.get('total', 0)} 클립")
    else:
        print(f"💤 대기 중 (idle)")


def cmd_quick_edit(args):
    """원스텝 자동 편집: 분석 → 프로젝트 생성 → (선택) 렌더링."""
    print(f"🚀 Quick Edit 시작")
    
    # 1. Link sources if they're absolute paths
    linked_files = []
    for f in args.files:
        fp = Path(f)
        if fp.is_absolute() and fp.exists():
            target = BASE / fp.name
            if not target.exists():
                os.symlink(str(fp), str(target))
                print(f"   🔗 링크: {fp.name}")
            linked_files.append(fp.name)
        else:
            linked_files.append(f)
    
    # 2. Analyze
    print(f"   🔍 분석 중... ({len(linked_files)}개 영상, {args.duration}초)")
    options = {
        "duration": args.duration,
        "clipMin": args.clip_min,
        "clipMax": args.clip_max,
        "subMode": args.sub_mode or "none",
        "context": args.context or "",
        "subLang": args.sub_lang or "ko",
    }
    api_post("/api/analyze", {"files": linked_files, "options": options})
    
    # Wait for analysis
    while True:
        time.sleep(2)
        status = api_get("/api/analyze/status")
        state = status.get("state")
        if state == "done":
            break
        elif state == "error":
            print(f"   ❌ 분석 실패: {status.get('error')}", file=sys.stderr)
            sys.exit(1)
        print(f"   ⏳ {status.get('progress', '...')}", end="\r", flush=True)
    
    result = status["result"]
    clips = result["clips"]
    subs = result.get("subs", [""] * len(clips))
    print(f"   ✅ 분석 완료: {len(clips)}개 클립")
    
    # 3. Build subtitle style
    sub_style = {
        "size": args.sub_size or 16,
        "x": args.sub_x if args.sub_x is not None else 50,
        "y": args.sub_y if args.sub_y is not None else 80,
        "font": args.sub_font or "'Apple SD Gothic Neo',sans-serif",
        "bg": not args.sub_no_bg,
        "bgColor": args.sub_bg_color or "#000000",
        "bgAlpha": (args.sub_bg_alpha / 100) if args.sub_bg_alpha is not None else 0.6,
        "color": args.sub_color or "#ffffff",
        "lineHeight": args.sub_line_height or 140,
        "textAlign": args.sub_text_align or "left",
    }
    if args.sub_stroke:
        sub_style["stroke"] = True
        sub_style["strokeColor"] = args.sub_stroke_color or "#000000"
        sub_style["strokeWidth"] = args.sub_stroke_width or 2
    
    # 4. Build global subs with timing
    global_subs = []
    t_offset = 0
    for i, c in enumerate(clips):
        dur = c["end"] - c["start"]
        text = subs[i] if i < len(subs) else ""
        if text:
            global_subs.append({
                "text": text,
                "start": t_offset,
                "end": t_offset + dur,
                "style": {**sub_style},
            })
        t_offset += dur
    
    # 5. Create project
    project = {
        "name": args.name or "Quick Edit",
        "clips": clips,
        "subs": subs,
        "globalSubs": global_subs,
        "clipMeta": [{"speed": 1, "transition": "none", "transDur": 0.3} for _ in clips],
        "sources": list(set(c["source"] for c in clips)),
        "defaultSubStyle": sub_style,
    }
    
    result = api_post("/api/projects/save", project)
    pid = result.get("id")
    print(f"   📁 프로젝트 생성: {pid}")
    
    # 6. Render if requested
    if args.render:
        print(f"   🎬 렌더링 시작...")
        render_clips = []
        for i, c in enumerate(clips):
            render_clips.append({
                "source": c["source"],
                "start": c["start"],
                "end": c["end"],
                "speed": 1,
                "crop": {"x": 0, "y": 0, "w": 100, "h": 100},
                "zoom": {"scale": 1, "panX": 0, "panY": 0},
            })
        
        render_data = {
            "clips": render_clips,
            "fps": 30,
            "maxDuration": args.duration,
            "subtitlesEnabled": True,
            "globalSubs": global_subs,
        }
        api_post("/api/render", render_data)
        
        while True:
            time.sleep(3)
            st = api_get("/api/render/status")
            if st.get("state") == "done":
                print(f"   ✅ 렌더링 완료: {st.get('output')}")
                break
            elif st.get("state") == "error":
                print(f"   ❌ 렌더링 실패: {st.get('error')}", file=sys.stderr)
                sys.exit(1)
            print(f"   🔄 {st.get('progress', 0)}/{st.get('total', 0)}...", end="\r", flush=True)
    else:
        print(f"\n📌 스튜디오에서 편집: http://localhost:3200/studio/video-edit")
        print(f"   프로젝트 ID: {pid}")
        print(f"   렌더링하려면: python3 studio_cli.py render --project {pid} --wait")


def cmd_edit_clips(args):
    """프로젝트의 클립 편집 (순서, 속도, 줌, 크롭, 전환 등)."""
    project = api_get(f"/api/projects/load/{args.project_id}")
    clips = project.get("clips", [])
    clip_meta = project.get("clipMeta", [{"speed": 1, "transition": "none", "transDur": 0.3} for _ in clips])
    clip_crops = project.get("clipCrops", [{"x": 0, "y": 0, "w": 100, "h": 100} for _ in clips])
    clip_zooms = project.get("clipZooms", [{"scale": 1, "panX": 0, "panY": 0} for _ in clips])
    
    # Pad arrays to match clip count
    while len(clip_meta) < len(clips):
        clip_meta.append({"speed": 1, "transition": "none", "transDur": 0.3})
    while len(clip_crops) < len(clips):
        clip_crops.append({"x": 0, "y": 0, "w": 100, "h": 100})
    while len(clip_zooms) < len(clips):
        clip_zooms.append({"scale": 1, "panX": 0, "panY": 0})
    
    if args.reorder:
        # --reorder "2,0,1,3" → 클립 순서 변경
        order = [int(x.strip()) for x in args.reorder.split(",")]
        clips = [clips[i] for i in order]
        clip_meta = [clip_meta[i] for i in order]
        clip_crops = [clip_crops[i] for i in order]
        clip_zooms = [clip_zooms[i] for i in order]
        subs = project.get("subs", [])
        if subs:
            padded_subs = subs + [""] * (len(order) - len(subs))
            project["subs"] = [padded_subs[i] for i in order]
        print(f"   🔀 클립 순서 변경: {order}")
    
    if args.remove_clips:
        # --remove-clips "1,3" → 해당 인덱스 클립 제거
        remove_idx = set(int(x.strip()) for x in args.remove_clips.split(","))
        clips = [c for i, c in enumerate(clips) if i not in remove_idx]
        clip_meta = [m for i, m in enumerate(clip_meta) if i not in remove_idx]
        clip_crops = [c for i, c in enumerate(clip_crops) if i not in remove_idx]
        clip_zooms = [z for i, z in enumerate(clip_zooms) if i not in remove_idx]
        subs = project.get("subs", [])
        if subs:
            project["subs"] = [s for i, s in enumerate(subs) if i not in remove_idx]
        print(f"   🗑️ 클립 제거: {remove_idx}")
    
    if args.split_at is not None:
        # --split-at 2 --split-time 3.5 → 클립 2를 3.5초 지점에서 분할
        idx = args.split_at
        split_t = args.split_time
        if idx < len(clips):
            clip = clips[idx]
            if clip["start"] < split_t < clip["end"]:
                clip_a = {**clip, "end": split_t}
                clip_b = {**clip, "start": split_t}
                clips = clips[:idx] + [clip_a, clip_b] + clips[idx+1:]
                clip_meta = clip_meta[:idx] + [clip_meta[idx].copy(), clip_meta[idx].copy()] + clip_meta[idx+1:]
                clip_crops = clip_crops[:idx] + [clip_crops[idx].copy(), clip_crops[idx].copy()] + clip_crops[idx+1:]
                clip_zooms = clip_zooms[:idx] + [clip_zooms[idx].copy(), clip_zooms[idx].copy()] + clip_zooms[idx+1:]
                print(f"   ✂️ 클립 {idx} 분할: {split_t:.1f}초 지점")
    
    if args.speed:
        # --speed "0:1.5,2:0.5" → 클립0 1.5배속, 클립2 0.5배속
        for pair in args.speed.split(","):
            idx_str, spd_str = pair.strip().split(":")
            idx = int(idx_str)
            if idx < len(clip_meta):
                clip_meta[idx]["speed"] = float(spd_str)
                print(f"   ⏩ 클립 {idx} 속도: {spd_str}x")
    
    # Transitions — 클립 사이 독립 배열
    transitions = project.get("transitions", [{"type": "none", "duration": 0.3} for _ in range(max(0, len(clips) - 1))])
    while len(transitions) < len(clips) - 1:
        transitions.append({"type": "none", "duration": 0.3})
    
    if args.transition:
        # --transition "fade" → 전체 적용 / --transition "0:fade,2:none" → 개별 (인덱스=클립 사이)
        if ":" in args.transition:
            for pair in args.transition.split(","):
                idx_str, tr = pair.strip().split(":")
                idx = int(idx_str)
                if idx < len(transitions):
                    transitions[idx]["type"] = tr
                    print(f"   전환 {idx} (클립{idx}→클립{idx+1}): {tr}")
        else:
            for t in transitions:
                t["type"] = args.transition
            print(f"   전환 효과 전체: {args.transition}")
    
    if args.transition_dur:
        for t in transitions:
            t["duration"] = args.transition_dur
        print(f"   전환 길이: {args.transition_dur}초")
    
    project["transitions"] = transitions
    
    if args.zoom:
        # --zoom "0:1.5,0,0" → 클립0에 1.5x줌 / --zoom-all "1.2,0,0" → 전체
        parts = args.zoom.split(",")
        if len(parts) == 3:
            # All clips
            scale, px, py = float(parts[0]), float(parts[1]), float(parts[2])
            for z in clip_zooms:
                z.update({"scale": scale, "panX": px, "panY": py})
            print(f"   🔍 전체 줌: {scale}x, pan({px},{py})")
        else:
            # Individual: "idx:scale:panX:panY"
            for item in args.zoom.split(";"):
                p = item.strip().split(":")
                if len(p) == 4:
                    idx = int(p[0])
                    if idx < len(clip_zooms):
                        clip_zooms[idx] = {"scale": float(p[1]), "panX": float(p[2]), "panY": float(p[3])}
                        print(f"   🔍 클립 {idx} 줌: {p[1]}x")
    
    if args.crop:
        # --crop "idx:x:y:w:h" or "x:y:w:h" for all
        parts = args.crop.split(":")
        if len(parts) == 4:
            x, y, w, h = float(parts[0]), float(parts[1]), float(parts[2]), float(parts[3])
            for c in clip_crops:
                c.update({"x": x, "y": y, "w": w, "h": h})
            print(f"   ✂️ 전체 크롭: x={x},y={y},w={w},h={h}")
        elif len(parts) == 5:
            idx = int(parts[0])
            if idx < len(clip_crops):
                clip_crops[idx] = {"x": float(parts[1]), "y": float(parts[2]), "w": float(parts[3]), "h": float(parts[4])}
                print(f"   ✂️ 클립 {idx} 크롭")
    
    if args.trim:
        # --trim "0:1.0:5.5,2:0:3" → 클립 시작/끝 변경
        for pair in args.trim.split(","):
            p = pair.strip().split(":")
            if len(p) == 3:
                idx, start, end = int(p[0]), float(p[1]), float(p[2])
                if idx < len(clips):
                    clips[idx]["start"] = start
                    clips[idx]["end"] = end
                    print(f"   ⏱️ 클립 {idx} 트림: {start:.1f}→{end:.1f}s")
    
    project["clips"] = clips
    project["clipMeta"] = clip_meta
    project["clipCrops"] = clip_crops
    project["clipZooms"] = clip_zooms
    
    result = api_post("/api/projects/save", project)
    print(f"✅ 클립 편집 완료: {result.get('id')}")


def cmd_add_effects(args):
    """이펙트 추가."""
    project = api_get(f"/api/projects/load/{args.project_id}")
    clips = project.get("clips", [])
    fx = {"type": args.type, "intensity": args.intensity, "duration": args.duration}
    
    if args.clip is not None:
        # 클립 이펙트
        clip_effects = project.get("clipEffects", [[] for _ in clips])
        while len(clip_effects) < len(clips):
            clip_effects.append([])
        if args.clear:
            clip_effects[args.clip] = []
        clip_effects[args.clip].append(fx)
        project["clipEffects"] = clip_effects
        print(f"✅ 클립 {args.clip}에 {args.type} 이펙트 추가 (intensity={args.intensity})")
    else:
        # 전체 적용 이펙트
        global_effects = project.get("globalEffects", [])
        if args.clear:
            global_effects = []
        global_effects.append(fx)
        project["globalEffects"] = global_effects
        print(f"✅ 전체 적용 {args.type} 이펙트 추가 (intensity={args.intensity})")
    
    result = api_post("/api/projects/save", project)
    print(f"   저장됨: {result.get('id')}")


def cmd_remove_effects(args):
    """이펙트 제거."""
    project = api_get(f"/api/projects/load/{args.project_id}")
    clips = project.get("clips", [])
    
    if args.clip is not None:
        clip_effects = project.get("clipEffects", [[] for _ in clips])
        while len(clip_effects) < len(clips):
            clip_effects.append([])
        if args.type:
            clip_effects[args.clip] = [fx for fx in clip_effects[args.clip] if fx.get("type") != args.type]
            print(f"✅ 클립 {args.clip}에서 {args.type} 이펙트 제거")
        else:
            clip_effects[args.clip] = []
            print(f"✅ 클립 {args.clip}의 모든 이펙트 제거")
        project["clipEffects"] = clip_effects
    else:
        global_effects = project.get("globalEffects", [])
        if args.type:
            global_effects = [fx for fx in global_effects if fx.get("type") != args.type]
            print(f"✅ 전체 적용 {args.type} 이펙트 제거")
        else:
            global_effects = []
            print(f"✅ 모든 전체 적용 이펙트 제거")
        project["globalEffects"] = global_effects
    
    result = api_post("/api/projects/save", project)
    print(f"   저장됨: {result.get('id')}")


def cmd_add_ken_burns(args):
    """Ken Burns 이펙트 추가."""
    project = api_get(f"/api/projects/load/{args.project_id}")
    kb_list = project.get("kbEffects", project.get("globalKB", []))
    kb_id = f"kb_{int(time.time()*1000)}"
    kb = {
        "id": kb_id,
        "effect": args.effect,
        "intensity": max(5, min(30, args.intensity)),
        "start": args.start,
        "end": args.end,
    }
    kb_list.append(kb)
    project["kbEffects"] = kb_list
    result = api_post("/api/projects/save", project)
    effect_names = {"zoom-in": "줌인", "zoom-out": "줌아웃", "pan-left": "좌패닝", "pan-right": "우패닝"}
    print(f"✅ Ken Burns 추가: {effect_names.get(args.effect, args.effect)} ({args.start}~{args.end}초, 강도 {args.intensity}%)")
    print(f"   저장됨: {result.get('id')}")


def cmd_remove_ken_burns(args):
    """Ken Burns 이펙트 제거."""
    project = api_get(f"/api/projects/load/{args.project_id}")
    kb_list = project.get("kbEffects", project.get("globalKB", []))
    if args.index is not None:
        if 0 <= args.index < len(kb_list):
            removed = kb_list.pop(args.index)
            print(f"✅ Ken Burns #{args.index} 제거: {removed.get('effect')}")
        else:
            print(f"❌ 인덱스 {args.index} 범위 초과 (0~{len(kb_list)-1})", file=sys.stderr)
            sys.exit(1)
    else:
        kb_list.clear()
        print(f"✅ 모든 Ken Burns 이펙트 제거")
    project["kbEffects"] = kb_list
    result = api_post("/api/projects/save", project)
    print(f"   저장됨: {result.get('id')}")


def cmd_set_reference(args):
    """프로젝트에 레퍼런스 영상 설정."""
    project = api_get(f"/api/projects/load/{args.project_id}")
    project["selectedRef"] = args.url
    result = api_post("/api/projects/save", project)
    print(f"✅ 레퍼런스 설정: {args.url[:60]}")
    print(f"   저장됨: {result.get('id')}")


def cmd_export(args):
    """프로젝트를 JSON 또는 SRT로 내보내기."""
    project = api_get(f"/api/projects/load/{args.project_id}")
    
    if args.format == "json":
        out = args.output or f"{args.project_id}.json"
        with open(out, "w") as f:
            json.dump(project, f, ensure_ascii=False, indent=2)
        print(f"✅ JSON 내보내기: {out}")
    
    elif args.format == "srt":
        out = args.output or f"{args.project_id}.srt"
        clips = project.get("clips", [])
        subs = project.get("subs", [])
        global_subs = project.get("globalSubs", [])
        
        srt_entries = []
        
        if global_subs:
            for i, gs in enumerate(global_subs):
                text = gs.get("text", "")
                start = gs.get("start", 0)
                end = gs.get("end", 0)
                if text:
                    srt_entries.append((i + 1, start, end, text))
        else:
            t_offset = 0
            for i, clip in enumerate(clips):
                dur = clip["end"] - clip["start"]
                sub = subs[i] if i < len(subs) else ""
                if sub:
                    srt_entries.append((i + 1, t_offset, t_offset + dur, sub))
                t_offset += dur
        
        def srt_time(s):
            h = int(s // 3600)
            m = int(s % 3600 // 60)
            sec = int(s % 60)
            ms = int((s % 1) * 1000)
            return f"{h:02d}:{m:02d}:{sec:02d},{ms:03d}"
        
        with open(out, "w") as f:
            for idx, start, end, text in srt_entries:
                f.write(f"{idx}\n")
                f.write(f"{srt_time(start)} --> {srt_time(end)}\n")
                f.write(f"{text}\n\n")
        
        print(f"✅ SRT 내보내기: {out} ({len(srt_entries)}개 자막)")


def cmd_list_fonts(_args):
    """사용 가능한 폰트 목록."""
    fonts = {
        "고딕": [
            "Apple SD Gothic Neo", "Noto Sans KR", "Pretendard", "GmarketSans",
            "SUITE", "Paperlogy", "LINESeedKR", "ONE Mobile OTF", "HDharmony"
        ],
        "강조/임팩트": [
            "BMDOHYEON (배민 도현)", "BMHANNAPro (배민 한나)", "BMJUA (배민 주아)",
            "Jalnan (잘난체)", "CookieRun (쿠키런)", "Cafe24 Ssurround (써라운드)",
            "Cafe24 Ssurround Air", "Moneygraphy (머니그라피)"
        ],
        "명조/바탕": [
            "AppleMyungjo", "Gowun Batang (고운바탕)", "MaruBuri (마루부리)", "Batang"
        ],
        "손글씨": [
            "HSYuji (HS유지체)", "MapoBackpacking (마포 배낭여행)", "MapoPeacefull (마포 평화)",
            "MapoDPP (마포 꽃)", "양진체", "Binggrae (빙그레)", "Binggrae Samanco",
            "SANGJU Gotgam (상주곶감)", "SANGJU Dajungdagam (상주다정다감)",
            "SANGJU Gyeongcheon Island (상주경천섬)", "RecipekoreaOTF (레시피코리아)", "MBC 1961"
        ],
        "영문": [
            "Arial", "Impact", "Montserrat", "Jost", "Nunito", "Inter",
            "Oswald", "Anton", "Bebas Neue", "Georgia", "Courier New"
        ],
        "영문 손글씨": [
            "Coming Soon", "Indie Flower", "Caveat"
        ],
    }
    for cat, names in fonts.items():
        print(f"\n📂 {cat}:")
        for name in names:
            print(f"   • {name}")


def _check_tool(name):
    """외부 도구 존재 확인."""
    from shutil import which
    if which(name) is None:
        print(f"❌ '{name}'이(가) 설치되어 있지 않습니다.", file=sys.stderr)
        sys.exit(1)


def _probe_video(path):
    """ffprobe로 영상 메타 정보 반환: {width, height, duration, fps}."""
    cmd = [
        "ffprobe", "-v", "quiet", "-print_format", "json",
        "-show_format", "-show_streams", str(path),
    ]
    out = subprocess.run(cmd, capture_output=True, text=True)
    if out.returncode != 0:
        return None
    info = json.loads(out.stdout)
    for s in info.get("streams", []):
        if s.get("codec_type") == "video":
            w = int(s.get("width", 0))
            h = int(s.get("height", 0))
            dur = float(info.get("format", {}).get("duration", 0))
            # fps
            r = s.get("r_frame_rate", "30/1")
            parts = r.split("/")
            fps = float(parts[0]) / float(parts[1]) if len(parts) == 2 and float(parts[1]) else 30
            return {"width": w, "height": h, "duration": dur, "fps": fps}
    return None


def _detect_scenes(video_path, threshold=0.25):
    """ffmpeg scene detect → 씬 전환 시점 리스트(초) 반환."""
    cmd = [
        "ffmpeg", "-i", str(video_path),
        "-vf", f"select='gt(scene,{threshold})',showinfo",
        "-vsync", "vfr", "-f", "null", "-",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    import re
    times = []
    for line in result.stderr.splitlines():
        m = re.search(r"pts_time:([\d.]+)", line)
        if m:
            times.append(float(m.group(1)))
    return times


def _download_reference(url):
    """yt-dlp로 레퍼런스 다운로드, 경로 반환."""
    _check_tool("yt-dlp")
    import re
    # ID 추출 시도
    m = re.search(r"/p/([A-Za-z0-9_-]+)", url)
    ref_id = m.group(1) if m else str(int(time.time()))
    out_path = f"/tmp/ref_{ref_id}.mp4"
    if os.path.exists(out_path):
        print(f"   📦 캐시된 레퍼런스 사용: {out_path}")
        return out_path
    print(f"   ⬇️  레퍼런스 다운로드 중...")
    cmd = ["yt-dlp", "-f", "best[ext=mp4]/best", "-o", out_path, url]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(f"❌ 다운로드 실패: {r.stderr[:200]}", file=sys.stderr)
        sys.exit(1)
    print(f"   ✅ 다운로드 완료: {out_path}")
    return out_path


def _get_ref_video_url(ref_id):
    """Studio API에서 ref_id에 해당하는 video_url 가져오기."""
    try:
        # Try server proxy first (localhost:8090), then direct (localhost:3200)
        for url in [f"{SERVER}/api/references", f"{SERVER}/api/references/videos"]:
            try:
                req = urllib.request.Request(url)
                with urllib.request.urlopen(req, timeout=5) as resp:
                    data = json.loads(resp.read())
                    break
            except Exception:
                continue
        else:
            raise Exception("Both proxy and direct API failed")
    except Exception as e:
        print(f"❌ 레퍼런스 API 호출 실패: {e}", file=sys.stderr)
        sys.exit(1)

    posts = data if isinstance(data, list) else data.get("videos", data.get("posts", data.get("data", [])))
    for post in posts:
        shortcode = post.get("shortcode", "")
        pid = post.get("id", "")
        if ref_id in (shortcode, str(pid)):
            video_url = post.get("video_url", "")
            if video_url:
                return video_url
            break
    print(f"❌ 레퍼런스 '{ref_id}'를 찾을 수 없거나 video_url이 없습니다.", file=sys.stderr)
    sys.exit(1)


def _scan_sources(folder, orientation):
    """소스 폴더에서 영상 파일 스캔, orientation 필터링."""
    exts = {".mov", ".mp4", ".avi", ".mkv", ".webm", ".m4v"}
    folder_path = Path(folder)
    if not folder_path.is_dir():
        print(f"❌ 소스 폴더 없음: {folder}", file=sys.stderr)
        sys.exit(1)

    sources = []
    for f in sorted(folder_path.iterdir()):
        if f.suffix.lower() not in exts or f.name.startswith("."):
            continue
        meta = _probe_video(f)
        if meta is None:
            continue
        # orientation 필터
        if orientation == "vertical" and meta["width"] >= meta["height"]:
            continue
        if orientation == "horizontal" and meta["height"] >= meta["width"]:
            continue
        if meta["duration"] < 1.0:
            continue
        sources.append({"path": f, "meta": meta})

    if not sources:
        print(f"❌ '{folder}'에 {orientation} 영상이 없습니다.", file=sys.stderr)
        sys.exit(1)
    return sources


# ── Smart 모드 헬퍼 함수들 ──

def _gemini_vision(image_paths, prompt, api_key):
    """Gemini Vision API로 이미지 분석."""
    parts = []
    for img_path in image_paths:
        with open(img_path, 'rb') as f:
            b64 = base64.b64encode(f.read()).decode()
        parts.append({"inline_data": {"mime_type": "image/jpeg", "data": b64}})
    parts.append({"text": prompt})
    data = json.dumps({"contents": [{"parts": parts}]}).encode()
    req = urllib.request.Request(
        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}",
        data=data,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        result = json.loads(resp.read())
        return result["candidates"][0]["content"]["parts"][0]["text"]


def _parse_vision_json(text):
    """Gemini 응답에서 JSON 배열 파싱 (마크다운 코드블록 제거)."""
    import re
    text = re.sub(r"```(?:json)?\s*", "", text)
    text = re.sub(r"```", "", text)
    return json.loads(text.strip())


def _extract_frames_ref(ref_path, boundaries):
    """레퍼런스 각 씬 중간 시점에서 프레임 추출."""
    paths = []
    for i in range(len(boundaries) - 1):
        mid = (boundaries[i] + boundaries[i + 1]) / 2
        out = f"/tmp/brxce_smart_ref_{i}.jpg"
        subprocess.run(
            ["ffmpeg", "-y", "-ss", str(mid), "-i", ref_path,
             "-vframes", "1", "-vf", "scale=320:-1", out],
            capture_output=True,
        )
        if os.path.exists(out):
            paths.append(out)
    return paths


def _extract_frames_sources(sorted_sources):
    """각 소스 영상에서 3개 프레임 추출 (0.5초, 중간, 끝-0.5초)."""
    all_paths = []
    source_frame_map = []  # (소스인덱스, 프레임경로들)
    for si, src in enumerate(sorted_sources):
        dur = src["meta"]["duration"]
        times = [0.5, dur / 2, max(0.5, dur - 0.5)]
        frames = []
        for fi, t in enumerate(times):
            out = f"/tmp/brxce_smart_src_{src['path'].stem}_{fi}.jpg"
            subprocess.run(
                ["ffmpeg", "-y", "-ss", str(t), "-i", str(src["path"]),
                 "-vframes", "1", "-vf", "scale=320:-1", out],
                capture_output=True,
            )
            if os.path.exists(out):
                frames.append(out)
                all_paths.append(out)
        source_frame_map.append({"src_idx": si, "frames": frames})
    return all_paths, source_frame_map


def _smart_match_clips(ref_tags, src_tags_list, sorted_sources, segments):
    """레퍼런스 씬 태그와 소스 태그를 매칭하여 클립 배치."""
    clips = []
    linked_files = set()
    used_recently = []  # 최근 사용한 소스 인덱스 (연속 방지)

    for scene_i, seg_dur in enumerate(segments):
        ref_tag = ref_tags[scene_i] if scene_i < len(ref_tags) else {}

        # 각 소스에 대해 점수 계산
        scored = []
        for si, src_tag in enumerate(src_tags_list):
            score = 0
            if ref_tag.get("scene_type") == src_tag.get("scene_type"):
                score += 3
            if ref_tag.get("lighting") == src_tag.get("lighting"):
                score += 2
            if ref_tag.get("angle") == src_tag.get("angle"):
                score += 1
            # quality 보너스
            score += src_tag.get("quality", 5) * 0.1
            scored.append((score, si))

        # 점수 내림차순, 같으면 파일명순(인덱스순) 유지
        scored.sort(key=lambda x: (-x[0], x[1]))

        # 같은 소스 연속 사용 금지 (최소 2클립 간격)
        chosen_idx = None
        for _score, si in scored:
            if si not in used_recently:
                chosen_idx = si
                break
        if chosen_idx is None:
            chosen_idx = scored[0][1] if scored else 0

        # 최근 사용 기록 업데이트
        used_recently.append(chosen_idx)
        if len(used_recently) > 2:
            used_recently.pop(0)

        src = sorted_sources[chosen_idx]
        src_meta = src["meta"]

        # start/end 계산 (기존 로직과 동일)
        usable_start = 0.5
        usable_end = max(usable_start + seg_dur, src_meta["duration"] - 0.5)
        max_start = usable_end - seg_dur
        if max_start <= usable_start:
            start = usable_start
        else:
            start = round(random.uniform(usable_start, max_start), 2)
        end = round(start + seg_dur, 2)
        if end > src_meta["duration"]:
            end = round(src_meta["duration"], 2)
            start = round(max(0, end - seg_dur), 2)

        clips.append({
            "source": src["path"].name,
            "start": start,
            "end": end,
        })
        linked_files.add(src["path"])

    return clips, linked_files


def _cleanup_smart_temps():
    """Smart 모드 임시 파일 정리."""
    for f in glob_mod.glob("/tmp/brxce_smart_*.jpg"):
        try:
            os.remove(f)
        except OSError:
            pass


def cmd_from_reference(args):
    """레퍼런스 기반 프로젝트 자동 생성."""
    _check_tool("ffmpeg")
    _check_tool("ffprobe")

    # ── 1. 레퍼런스 영상 확보 ──
    ref_url_for_project = None
    if args.ref:
        ref_path = _download_reference(args.ref)
        ref_url_for_project = args.ref
    elif args.ref_id:
        video_url = _get_ref_video_url(args.ref_id)
        ref_path = _download_reference(video_url)
        ref_url_for_project = video_url
    elif args.ref_file:
        ref_path = args.ref_file
        if not os.path.exists(ref_path):
            print(f"❌ 레퍼런스 파일 없음: {ref_path}", file=sys.stderr)
            sys.exit(1)
    else:
        print("❌ --ref, --ref-id, --ref-file 중 하나 필요", file=sys.stderr)
        sys.exit(1)

    # ── 2. 레퍼런스 분석 ──
    print(f"🔍 레퍼런스 분석 중...")
    ref_meta = _probe_video(ref_path)
    if ref_meta is None:
        print(f"❌ 레퍼런스 영상 분석 실패", file=sys.stderr)
        sys.exit(1)

    ref_duration = ref_meta["duration"]
    target_duration = args.duration or ref_duration
    print(f"   해상도: {ref_meta['width']}x{ref_meta['height']}, 길이: {ref_duration:.1f}초, fps: {ref_meta['fps']:.0f}")

    # 씬 감지
    scene_times = _detect_scenes(ref_path, args.scene_threshold)
    # 씬 전환 시점 → 구간 리스트
    boundaries = [0.0] + scene_times + [ref_duration]
    # 중복/역순 제거
    boundaries = sorted(set(boundaries))
    raw_segments = []
    for i in range(len(boundaries) - 1):
        seg_dur = boundaries[i + 1] - boundaries[i]
        if seg_dur >= 0.3:  # 너무 짧은 구간 무시
            raw_segments.append(seg_dur)

    if not raw_segments:
        raw_segments = [ref_duration]

    # duration 스케일링: 레퍼런스 패턴을 target_duration에 맞게 비율 조정
    ref_total = sum(raw_segments)
    scale = target_duration / ref_total if ref_total > 0 else 1.0
    segments = [round(s * scale, 2) for s in raw_segments]
    # 최소 클립 길이 보정
    segments = [max(0.5, s) for s in segments]

    # 편집 밀도 판단
    avg_seg = sum(segments) / len(segments) if segments else target_duration
    if avg_seg < 1.5:
        density = "fast"
    elif avg_seg < 4.0:
        density = "normal"
    else:
        density = "slow"

    print(f"   씬 {len(segments)}개 감지, 평균 {avg_seg:.1f}초/씬, 밀도: {density}")

    # ── 3. 소스 영상 스캔 ──
    print(f"📂 소스 스캔 중: {args.sources}")
    sources = _scan_sources(args.sources, args.orientation)
    print(f"   {args.orientation} 영상 {len(sources)}개 발견")

    # ── 4. 클립 배치 ──
    print(f"🎬 클립 배치 중...")
    # 소스를 파일명 순서(촬영 시간순)로 정렬 — 영상 흐름 유지
    sorted_sources = sorted(sources, key=lambda s: s["path"].name)

    if args.smart:
        # ── Smart 모드: AI Vision 기반 콘티 매칭 ──
        if not args.gemini_key:
            print("⚠️  --gemini-key 또는 GEMINI_API_KEY 환경변수 필요. 기본 모드로 fallback.", file=sys.stderr)
            args.smart = False

    if args.smart:
        try:
            print(f"   🤖 Smart 모드: AI Vision 분석 시작...")

            # Step A: 레퍼런스 프레임 추출
            print(f"   📸 레퍼런스 프레임 추출 ({len(boundaries)-1}개 씬)...")
            ref_frames = _extract_frames_ref(ref_path, boundaries)
            if not ref_frames:
                raise RuntimeError("레퍼런스 프레임 추출 실패")

            # Step B: 소스 프레임 추출
            print(f"   📸 소스 프레임 추출 ({len(sorted_sources)}개 소스)...")
            all_src_frames, source_frame_map = _extract_frames_sources(sorted_sources)

            # Step C: Gemini Vision API 호출 — 레퍼런스 분석
            print(f"   🧠 레퍼런스 씬 분석 중...")
            ref_prompt = (
                f"Analyze each video frame. Return a JSON array with exactly {len(ref_frames)} objects:\n"
                '[{"scene_type": "intro|work|transition|closeup|wide|outro", '
                '"angle": "high|eye|low|top|side", '
                '"lighting": "day|night|indoor|outdoor", '
                '"description": "brief description"}]\n'
                "Output ONLY the JSON array, no other text."
            )
            ref_result = _gemini_vision(ref_frames, ref_prompt, args.gemini_key)
            ref_tags = _parse_vision_json(ref_result)
            print(f"   ✅ 레퍼런스 태그 {len(ref_tags)}개 추출")

            # Step C-2: 소스 분석 (10개씩 배치)
            print(f"   🧠 소스 영상 분석 중...")
            src_tags_list = []
            batch_size = 10
            src_frame_paths = []
            src_frame_indices = []  # 어떤 소스에 속하는지
            for sfm in source_frame_map:
                if sfm["frames"]:
                    # 대표 프레임 1개 (중간 프레임)
                    mid_frame = sfm["frames"][len(sfm["frames"]) // 2]
                    src_frame_paths.append(mid_frame)
                    src_frame_indices.append(sfm["src_idx"])

            for batch_start in range(0, len(src_frame_paths), batch_size):
                batch = src_frame_paths[batch_start:batch_start + batch_size]
                src_prompt = (
                    f"Analyze each video frame from source footage. Return a JSON array with exactly {len(batch)} objects:\n"
                    '[{"scene_type": "intro|work|transition|closeup|wide|outro", '
                    '"angle": "high|eye|low|top|side", '
                    '"lighting": "day|night|indoor|outdoor", '
                    '"description": "brief description", '
                    '"quality": 1-10}]\n'
                    "Output ONLY the JSON array, no other text."
                )
                batch_result = _gemini_vision(batch, src_prompt, args.gemini_key)
                batch_tags = _parse_vision_json(batch_result)
                src_tags_list.extend(batch_tags)
                print(f"   ✅ 소스 배치 {batch_start // batch_size + 1} 완료 ({len(batch_tags)}개)")

            print(f"   🔗 스마트 매칭 중...")
            clips, linked_files = _smart_match_clips(ref_tags, src_tags_list, sorted_sources, segments)
            print(f"   ✅ Smart 매칭 완료: {len(clips)}개 클립")

            # 임시 파일 정리
            _cleanup_smart_temps()

        except Exception as e:
            print(f"⚠️  Smart 모드 실패, 기본 모드로 fallback: {e}", file=sys.stderr)
            _cleanup_smart_temps()
            args.smart = False

    if not args.smart:
        # ── 기본 모드: 시간순 균등 배분 ──
        clips = []
        linked_files = set()

        # 소스 수와 씬 수에 따라 균등 배분
        step = max(1, len(sorted_sources) // len(segments)) if segments else 1

        for i, seg_dur in enumerate(segments):
            src_idx = min(i * step, len(sorted_sources) - 1)
            src = sorted_sources[src_idx]
            src_meta = src["meta"]

            # 연속 방지: 직전과 같은 소스면 다음으로
            if clips and clips[-1]["source"] == src["path"].name and len(sorted_sources) > 1:
                alt_idx = min(src_idx + 1, len(sorted_sources) - 1)
                src = sorted_sources[alt_idx]
                src_meta = src["meta"]

            # 랜덤 시작점 (여유 0.5s)
            usable_start = 0.5
            usable_end = max(usable_start + seg_dur, src_meta["duration"] - 0.5)
            max_start = usable_end - seg_dur
            if max_start <= usable_start:
                start = usable_start
            else:
                start = round(random.uniform(usable_start, max_start), 2)
            end = round(start + seg_dur, 2)
            if end > src_meta["duration"]:
                end = round(src_meta["duration"], 2)
                start = round(max(0, end - seg_dur), 2)

            clips.append({
                "source": src["path"].name,
                "start": start,
                "end": end,
            })
            linked_files.add(src["path"])

    # ── 5. 소스 심볼릭 링크 ──
    for src_path in linked_files:
        target = BASE / src_path.name
        if not target.exists():
            os.symlink(str(src_path.resolve()), str(target))
            print(f"   🔗 링크: {src_path.name}")

    # ── 6. 전환효과 설정 ──
    if args.transition == "auto":
        if density == "fast":
            tr_type = "none"
            tr_dur = 0
        elif density == "normal":
            tr_type = "fade"
            tr_dur = 0.3
        else:
            tr_type = "fade"
            tr_dur = 0.5
    elif args.transition == "fade":
        tr_type = "fade"
        tr_dur = 0.3
    else:
        tr_type = "none"
        tr_dur = 0

    transitions = [{"type": tr_type, "duration": tr_dur} for _ in range(max(0, len(clips) - 1))]

    # 클립 메타
    clip_meta = [{"speed": 1, "transition": "none", "transDur": 0.3} for _ in clips]

    # 페이드인/아웃 — 명시적으로 지정한 경우만 활성화
    fade_in_out = {
        "fadeIn": {"enabled": args.fade_in is not None, "duration": args.fade_in or 1.0},
        "fadeOut": {"enabled": args.fade_out is not None, "duration": args.fade_out or 1.5},
    }

    # ── 7. 프로젝트 저장 ──
    project_name = args.name or f"레퍼런스 프로젝트 ({len(clips)}클립)"
    project = {
        "name": project_name,
        "clips": clips,
        "subs": [""] * len(clips),
        "clipMeta": clip_meta,
        "transitions": transitions,
        "fadeInOut": fade_in_out,
        "sources": list(set(c["source"] for c in clips)),
    }
    if ref_url_for_project:
        project["selectedRef"] = ref_url_for_project

    result = api_post("/api/projects/save", project)
    pid = result.get("id", "?")
    total_dur = sum(c["end"] - c["start"] for c in clips)

    print(f"\n✅ 프로젝트 생성 완료!")
    print(f"   이름: {project_name}")
    print(f"   ID: {pid}")
    print(f"   클립: {len(clips)}개, 총 {total_dur:.1f}초")
    print(f"   전환: {tr_type} ({tr_dur}s)")
    print(f"   페이드: in {args.fade_in}s / out {args.fade_out}s")
    for i, c in enumerate(clips):
        dur = c["end"] - c["start"]
        print(f"   [{i}] {c['source']} {c['start']:.1f}→{c['end']:.1f}s ({dur:.1f}s)")

    # ── 8. 렌더링 (선택) ──
    if args.render:
        print(f"\n🎬 렌더링 시작...")
        render_clips = []
        for c in clips:
            render_clips.append({
                "source": c["source"],
                "start": c["start"],
                "end": c["end"],
                "speed": 1,
                "crop": {"x": 0, "y": 0, "w": 100, "h": 100},
                "zoom": {"scale": 1, "panX": 0, "panY": 0},
            })
        render_data = {
            "clips": render_clips,
            "fps": 30,
            "maxDuration": args.duration,
            "subtitlesEnabled": False,
            "transitions": transitions,
            "fadeIn": fade_in_out["fadeIn"],
            "fadeOut": fade_in_out["fadeOut"],
        }
        api_post("/api/render", render_data)

        if args.wait:
            while True:
                time.sleep(3)
                st = api_get("/api/render/status")
                if st.get("state") == "done":
                    print(f"\n✅ 렌더링 완료: {st.get('output')}")
                    break
                elif st.get("state") == "error":
                    print(f"\n❌ 렌더링 실패: {st.get('error')}", file=sys.stderr)
                    sys.exit(1)
                print(f"\r   🔄 {st.get('progress', 0)}/{st.get('total', 0)}...", end="", flush=True)
        else:
            print(f"   렌더링 상태 확인: python3 studio_cli.py render-status")
    else:
        print(f"\n📌 스튜디오에서 편집: http://localhost:3200/studio/video-edit")
        print(f"   렌더링하려면: python3 studio_cli.py render --project {pid} --wait")


def cmd_link_source(args):
    """소스 영상을 video-editor에 심볼릭 링크."""
    for src in args.sources:
        src_path = Path(src).resolve()
        if not src_path.exists():
            print(f"❌ 파일 없음: {src}", file=sys.stderr)
            continue
        target = BASE / src_path.name
        if target.exists():
            print(f"⏭️  이미 존재: {src_path.name}")
        else:
            os.symlink(str(src_path), str(target))
            print(f"🔗 링크: {src_path.name}")


def main():
    parser = argparse.ArgumentParser(
        description="BrxceStudio Video Editor CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    sub = parser.add_subparsers(dest="command", help="명령")
    
    # status
    sub.add_parser("status", help="서버 상태 확인")
    
    # list-videos
    sub.add_parser("list-videos", help="영상 소스 목록")
    
    # list-projects
    sub.add_parser("list-projects", help="프로젝트 목록")
    
    # load-project
    p = sub.add_parser("load-project", help="프로젝트 로드")
    p.add_argument("project_id", help="프로젝트 ID")
    p.add_argument("--json", action="store_true", help="JSON으로 출력")
    
    # create-project
    p = sub.add_parser("create-project", help="프로젝트 생성")
    p.add_argument("--name", help="프로젝트 이름")
    p.add_argument("--from-file", help="JSON 파일에서 로드")
    p.add_argument("--from-analyze", action="store_true", help="분석 결과에서 생성")
    p.add_argument("--clips-json", help="클립 JSON 문자열")
    
    # add-subs
    p = sub.add_parser("add-subs", help="자막 추가/수정")
    p.add_argument("--project", dest="project_id", required=True, help="프로젝트 ID")
    p.add_argument("--subs-file", help="자막 JSON 파일")
    p.add_argument("--subs-json", help="자막 JSON 문자열")
    p.add_argument("--font", help="폰트 (예: \"'BMDOHYEON',sans-serif\")")
    p.add_argument("--size", type=int, help="글자 크기")
    p.add_argument("--color", help="글자색 (#ffffff)")
    p.add_argument("--line-height", type=int, help="행간 (퍼센트)")
    p.add_argument("--text-align", choices=["left", "center", "right"], help="정렬")
    p.add_argument("--bg", type=bool, default=None, help="배경 표시")
    p.add_argument("--bg-color", help="배경색")
    p.add_argument("--bg-alpha", type=float, help="배경 투명도 0~100")
    p.add_argument("--stroke", action="store_true", help="외곽선 활성화")
    p.add_argument("--stroke-color", help="외곽선 색")
    p.add_argument("--stroke-width", type=int, help="외곽선 두께")
    p.add_argument("--x", type=float, help="가로 위치 (퍼센트)")
    p.add_argument("--y", type=float, help="세로 위치 (퍼센트)")
    p.add_argument("--box-width", type=int, help="텍스트 박스 너비 (퍼센트, 0=자동)")
    
    # add-effects
    p = sub.add_parser("add-effects", help="이펙트 추가/수정")
    p.add_argument("--project", dest="project_id", required=True, help="프로젝트 ID")
    p.add_argument("--clip", type=int, help="클립 인덱스 (없으면 전체 적용)")
    p.add_argument("--type", required=True, choices=["grain","vhs","glitch","blur","sharpen","vignette","bw","sepia","fadeIn","fadeOut","slowmo","speedup"], help="이펙트 종류")
    p.add_argument("--intensity", type=float, default=0.5, help="강도 (0~1)")
    p.add_argument("--duration", type=float, default=1.0, help="시간 (초, fade 전용)")
    p.add_argument("--clear", action="store_true", help="기존 이펙트 제거 후 추가")
    
    # remove-effects
    p = sub.add_parser("remove-effects", help="이펙트 제거")
    p.add_argument("--project", dest="project_id", required=True, help="프로젝트 ID")
    p.add_argument("--clip", type=int, help="클립 인덱스 (없으면 전체 적용 이펙트)")
    p.add_argument("--type", help="특정 이펙트 종류만 제거 (없으면 모두 제거)")
    
    # add-ken-burns
    p = sub.add_parser("add-ken-burns", help="Ken Burns 이펙트 추가")
    p.add_argument("--project", dest="project_id", required=True, help="프로젝트 ID")
    p.add_argument("--effect", required=True, choices=["zoom-in","zoom-out","pan-left","pan-right"], help="이펙트 종류")
    p.add_argument("--intensity", type=int, default=15, help="강도 (5~30)")
    p.add_argument("--start", type=float, required=True, help="시작 시간 (초)")
    p.add_argument("--end", type=float, required=True, help="끝 시간 (초)")
    
    # remove-ken-burns
    p = sub.add_parser("remove-ken-burns", help="Ken Burns 이펙트 제거")
    p.add_argument("--project", dest="project_id", required=True, help="프로젝트 ID")
    p.add_argument("--index", type=int, help="제거할 인덱스 (없으면 모두 제거)")
    
    # set-reference
    p = sub.add_parser("set-reference", help="레퍼런스 영상 설정")
    p.add_argument("--project", dest="project_id", required=True, help="프로젝트 ID")
    p.add_argument("--url", required=True, help="레퍼런스 영상 URL")
    
    # analyze
    p = sub.add_parser("analyze", help="영상 분석")
    p.add_argument("--files", nargs="+", required=True, help="영상 파일명들")
    p.add_argument("--duration", type=int, default=60, help="목표 길이(초)")
    p.add_argument("--clip-min", type=float, default=1.5, help="클립 최소(초)")
    p.add_argument("--clip-max", type=float, default=8, help="클립 최대(초)")
    p.add_argument("--sub-mode", choices=["none", "whisper", "context"], help="자막 모드")
    p.add_argument("--context", help="AI 자막 생성 컨텍스트")
    p.add_argument("--sub-lang", default="ko", help="자막 언어")
    p.add_argument("--wait", action="store_true", help="분석 완료까지 대기")
    
    # analyze-status
    sub.add_parser("analyze-status", help="분석 상태 확인")
    
    # render
    p = sub.add_parser("render", help="렌더링")
    p.add_argument("--project", dest="project_id", required=True, help="프로젝트 ID")
    p.add_argument("--fps", type=int, default=30, help="FPS")
    p.add_argument("--max-duration", type=int, help="최대 길이(초)")
    p.add_argument("--output-name", help="출력 파일 이름 (확장자 제외)")
    p.add_argument("--fade-in", type=float, help="페이드 인 시간 (초)")
    p.add_argument("--fade-out", type=float, help="페이드 아웃 시간 (초)")
    p.add_argument("--no-subs", action="store_true", help="자막 없이 렌더링")
    p.add_argument("--wait", action="store_true", help="렌더링 완료까지 대기")
    
    # render-status
    sub.add_parser("render-status", help="렌더링 상태 확인")
    
    # quick-edit
    p = sub.add_parser("quick-edit", help="원스텝 자동 편집")
    p.add_argument("--files", nargs="+", required=True, help="영상 파일들 (경로 또는 파일명)")
    p.add_argument("--name", help="프로젝트 이름")
    p.add_argument("--duration", type=int, default=30, help="목표 길이(초)")
    p.add_argument("--clip-min", type=float, default=1.5, help="클립 최소(초)")
    p.add_argument("--clip-max", type=float, default=5, help="클립 최대(초)")
    p.add_argument("--sub-mode", choices=["none", "whisper", "context"], help="자막 모드")
    p.add_argument("--context", help="AI 자막 컨텍스트")
    p.add_argument("--sub-lang", default="ko", help="자막 언어")
    p.add_argument("--sub-font", help="자막 폰트")
    p.add_argument("--sub-size", type=int, help="자막 크기")
    p.add_argument("--sub-color", help="자막 색 (#ffffff)")
    p.add_argument("--sub-line-height", type=int, help="행간 (퍼센트)")
    p.add_argument("--sub-text-align", choices=["left", "center", "right"], help="정렬")
    p.add_argument("--sub-x", type=float, help="가로 위치")
    p.add_argument("--sub-y", type=float, help="세로 위치")
    p.add_argument("--sub-no-bg", action="store_true", help="자막 배경 없음")
    p.add_argument("--sub-bg-color", help="자막 배경색")
    p.add_argument("--sub-bg-alpha", type=int, help="자막 배경 투명도 0~100")
    p.add_argument("--sub-stroke", action="store_true", help="외곽선")
    p.add_argument("--sub-stroke-color", help="외곽선 색")
    p.add_argument("--sub-stroke-width", type=int, help="외곽선 두께")
    p.add_argument("--render", action="store_true", help="분석 후 바로 렌더링까지")
    
    # edit-clips
    p = sub.add_parser("edit-clips", help="클립 편집 (순서/속도/줌/크롭/전환)")
    p.add_argument("--project", dest="project_id", required=True, help="프로젝트 ID")
    p.add_argument("--reorder", help="클립 순서 변경 (예: 2,0,1,3)")
    p.add_argument("--remove-clips", help="클립 제거 (예: 1,3)")
    p.add_argument("--split-at", type=int, help="분할할 클립 인덱스")
    p.add_argument("--split-time", type=float, help="분할 시점 (초)")
    p.add_argument("--speed", help="속도 변경 (예: 0:1.5,2:0.5)")
    p.add_argument("--transition", help="전환 효과 (fade/none, 또는 0:fade,2:none)")
    p.add_argument("--transition-dur", type=float, help="전환 길이 (초)")
    p.add_argument("--zoom", help="줌 (전체: scale,panX,panY / 개별: idx:scale:panX:panY)")
    p.add_argument("--crop", help="크롭 (전체: x:y:w:h / 개별: idx:x:y:w:h)")
    p.add_argument("--trim", help="트림 (예: 0:1.0:5.5,2:0:3)")
    
    # export
    p = sub.add_parser("export", help="프로젝트 내보내기 (JSON/SRT)")
    p.add_argument("--project", dest="project_id", required=True, help="프로젝트 ID")
    p.add_argument("--format", choices=["json", "srt"], default="json", help="출력 형식")
    p.add_argument("--output", "-o", help="출력 파일 경로")
    
    # list-fonts
    sub.add_parser("list-fonts", help="폰트 목록")
    
    # from-reference
    p = sub.add_parser("from-reference", help="레퍼런스 기반 프로젝트 자동 생성")
    p.add_argument("--ref", help="레퍼런스 URL (인스타/유튜브)")
    p.add_argument("--ref-id", help="Studio 레퍼런스 ID")
    p.add_argument("--ref-file", help="로컬 레퍼런스 파일")
    p.add_argument("--sources", required=True, help="소스 영상 폴더")
    p.add_argument("--name", help="프로젝트 이름")
    p.add_argument("--duration", type=int, default=30, help="목표 길이(초)")
    p.add_argument("--orientation", choices=["vertical", "horizontal"], default="vertical")
    p.add_argument("--scene-threshold", type=float, default=0.25, help="씬 감지 임계값")
    p.add_argument("--transition", choices=["none", "fade", "auto"], default="auto", help="전환효과")
    p.add_argument("--fade-in", type=float, default=None, help="페이드 인 (초, 미지정시 비활성)")
    p.add_argument("--fade-out", type=float, default=None, help="페이드 아웃 (초, 미지정시 비활성)")
    p.add_argument("--smart", action="store_true", help="AI Vision 기반 콘티 매칭 (Gemini)")
    p.add_argument("--gemini-key", default=os.environ.get("GEMINI_API_KEY", ""), help="Gemini API 키 (기본: GEMINI_API_KEY 환경변수)")
    p.add_argument("--render", action="store_true", help="생성 후 바로 렌더")
    p.add_argument("--wait", action="store_true", help="렌더 완료 대기")

    # link-source
    p = sub.add_parser("link-source", help="소스 영상 링크")
    p.add_argument("sources", nargs="+", help="영상 파일 경로들")
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(0)
    
    commands = {
        "status": cmd_status,
        "list-videos": cmd_list_videos,
        "list-projects": cmd_list_projects,
        "load-project": cmd_load_project,
        "create-project": cmd_create_project,
        "add-subs": cmd_add_subs,
        "add-effects": cmd_add_effects,
        "remove-effects": cmd_remove_effects,
        "add-ken-burns": cmd_add_ken_burns,
        "remove-ken-burns": cmd_remove_ken_burns,
        "set-reference": cmd_set_reference,
        "analyze": cmd_analyze,
        "analyze-status": cmd_analyze_status,
        "render": cmd_render,
        "render-status": cmd_render_status,
        "quick-edit": cmd_quick_edit,
        "edit-clips": cmd_edit_clips,
        "export": cmd_export,
        "list-fonts": cmd_list_fonts,
        "from-reference": cmd_from_reference,
        "link-source": cmd_link_source,
    }
    
    fn = commands.get(args.command)
    if fn:
        fn(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
