FROM python:3.12-slim

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    && pip install yt-dlp \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App code
COPY . .

ENV PORT=8092
ENV STORAGE_MODE=local

EXPOSE 8092

CMD ["python", "-m", "uvicorn", "src.server.app:app", "--host", "0.0.0.0", "--port", "8092", "--timeout-keep-alive", "600"]
