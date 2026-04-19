const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: '.env.local' });

// EDITOR_API_DIR 결정 순서:
//   1. env `EDITOR_API_DIR` 명시 (고객이 editor 를 다른 경로에 설치한 경우)
//   2. 기본값 = `<repo>/editor`  (이 스크립트는 dashboard/scripts/ 에 있으니 ../../editor)
// 이렇게 해서 repo clone 후 별도 설정 없이 바로 dev:all 돌아가도록.
const defaultEditorDir = path.resolve(__dirname, '..', '..', 'editor');
const editorDir = path.resolve(process.env.EDITOR_API_DIR || defaultEditorDir);

if (!fs.existsSync(editorDir)) {
  console.log(`[editor-api] editor directory not found at ${editorDir} — skipping editor startup`);
  process.exit(0);
}

if (!fs.existsSync(path.join(editorDir, '.venv'))) {
  console.log(
    `[editor-api] ${editorDir}/.venv not found — run "cd ${editorDir} && python3 -m venv .venv && pip install -r requirements.txt" first. Skipping editor startup.`,
  );
  process.exit(0);
}

// Editor 가 dashboard 의 NEXT_PUBLIC_EDITOR_API_URL (기본 http://localhost:8092) 와
// 매칭되도록 PORT 를 명시 전달. 기본값 없으면 8092.
const editorPort = process.env.EDITOR_API_PORT || '8092';

require('child_process').execSync('.venv/bin/python -m src.server.app', {
  stdio: 'inherit',
  cwd: editorDir,
  env: { ...process.env, PORT: editorPort },
});
