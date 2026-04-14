const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: '.env.local' });

const editorDir = path.resolve(process.env.EDITOR_API_DIR || '');

if (!editorDir || !fs.existsSync(path.join(editorDir, '.venv'))) {
  console.log('[editor-api] EDITOR_API_DIR not set or invalid');
  process.exit(0);
}

require('child_process').execSync('.venv/bin/python -m src.server.app', {
  stdio: 'inherit',
  cwd: editorDir,
});
