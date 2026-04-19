const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: '.env.local' });

const editorDir = path.resolve(process.env.EDITOR_API_DIR || '');

if (!editorDir || !fs.existsSync(path.join(editorDir, '.venv'))) {
  console.log('[editor-api] EDITOR_API_DIR not set or invalid');
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
