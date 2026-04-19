# brxce-editor 팀원 세팅 가이드

> 2026-04-18 부터 agentic-cms/editor/ 서브디렉토리에 임베드됨. 이 가이드도 해당 경로 기준.

## 사전 준비
- **Node.js** 18+ (`node -v`로 확인)
- **Python** 3.12+ (`python3 --version`로 확인)
- **pnpm** (`npm install -g pnpm`)
- **ffmpeg** (`brew install ffmpeg`)

## 1. 프로젝트 클론 + 설치

```bash
git clone https://github.com/intellieffect/agentic-cms.git
cd agentic-cms/editor
make setup
```

## 2. 환경변수 설정

같이 전달된 `brxce-editor-팀원용.env` 파일을 `.env`로 복사:

```bash
cp ~/Desktop/brxce-editor-팀원용.env .env
```

## 3. SMB 영상 소스 연결

1. Finder 열기
2. `Cmd + K` (서버에 연결)
3. `smb://192.168.219.52/Media/` 입력 → 연결
4. `/Volumes/Media/`로 마운트 확인

## 4. 실행

```bash
make dev
```

## 5. 접속

| URL | 설명 |
|-----|------|
| http://localhost:3100 | 프로젝트 목록 |
| http://localhost:3100/studio?project=ID | 영상 에디터 |
| http://localhost:3100/references | 레퍼런스 관리 |
| http://localhost:3100/dashboard | 경로 대시보드 |
| http://localhost:8092/docs | API 문서 |

## 문제 해결

| 증상 | 해결 |
|------|------|
| 영상이 안 보임 | SMB 연결 확인 (`ls /Volumes/Media/`) |
| 프로젝트 목록 비어있음 | `.env` SUPABASE 키 확인 |
| make dev 에러 | `make setup` 다시 실행 |
| 영상 버벅임 | 프록시 자동 생성 대기 (첫 로드 시 ~30초) |
