# Editor API (Video/Carousel Backend)

brxce-editor의 Python FastAPI 서버입니다.

## 실행 방법

```bash
# brxce-editor 프로젝트에서 직접 실행
cd ~/Projects/brxce-editor
.venv/bin/python -m src.server.app
# 기본 포트: 8092
```

## 환경변수

Dashboard에서 연결하려면:
- `NEXT_PUBLIC_EDITOR_API_URL=http://localhost:8092`

## API 엔드포인트

- POST /api/projects/save — 프로젝트 저장
- GET /api/projects — 프로젝트 목록
- GET /api/projects/load/{id} — 프로젝트 로드
- POST /api/bgm/beats — 비트 추출
- POST /api/render — 렌더링
- GET /api/list-videos — 영상 목록
- GET /api/media/probe/{filename} — 미디어 메타데이터
