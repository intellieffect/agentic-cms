.PHONY: dev server frontend setup install db-setup help

# ─── Quick Start ───

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

setup: ## Full setup (Python + Node + Remotion + env)
	@echo "📦 Setting up brxce-editor..."
	python3 -m venv .venv
	.venv/bin/pip install -r requirements.txt
	npm install
	cd remotion && pnpm install
	@if [ ! -f .env ]; then cp .env.example .env; echo "📝 .env created — edit it with your Supabase credentials"; fi
	@echo "✅ Setup complete! Run 'make dev' to start."
	@echo "⚠️  .env 파일에 SUPABASE 키를 입력하세요 (팀원용 .env는 프로젝트 관리자에게 문의)"

install: ## Install dependencies only
	.venv/bin/pip install -r requirements.txt
	npm install

dev: ## Start both servers (FastAPI + Next.js)
	@echo "🚀 Starting brxce-editor..."
	@trap 'kill 0' EXIT; \
	.venv/bin/python -m uvicorn src.server.app:app --host 0.0.0.0 --port $${PORT:-8092} --timeout-keep-alive 600 & \
	npm run dev & \
	wait

server: ## Start FastAPI backend only
	.venv/bin/python -m uvicorn src.server.app:app --host 0.0.0.0 --port $${PORT:-8092} --timeout-keep-alive 600

frontend: ## Start Next.js frontend only
	npm run dev

db-setup: ## Print DB setup instructions
	@echo "Run these SQL files in your Supabase SQL Editor:"
	@echo "  1. supabase/migrations/001_init.sql"
	@echo "  2. supabase/migrations/20260323_add_favorite.sql"
	@echo "  3. Create 'references' storage bucket (public)"
