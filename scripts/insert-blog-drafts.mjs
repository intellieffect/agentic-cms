#!/usr/bin/env node
// Insert AWC case-study drafts from Obsidian vault into blog_posts (status=draft).
// - Reads markdown files, parses metadata table + body
// - Converts body to PlateJS JSON via @awc/content-core CLI
// - Idempotent: skips if slug already exists in blog_posts
//
// Usage:
//   node scripts/insert-blog-drafts.mjs --dry-run
//   node scripts/insert-blog-drafts.mjs

import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DRAFTS_DIR = '/Users/jangdongjin/Documents/Intellieffect-Vault/02-Projects/AWC/사례원문';
const CLI_PATH = '/Users/jangdongjin/Projects/awc/packages/content-core/dist/cli.js';
const CATEGORY_ID_CASE_STUDY = '62337e90-bb6a-4215-8ee9-222eaf352956';
const ENV_FILE = '/Users/jangdongjin/Projects/awc/apps/studio/.env.local';

const DRY_RUN = process.argv.includes('--dry-run');

// --- Env loader (no external deps) --------------------------------
async function loadEnv(path) {
  const raw = await readFile(path, 'utf-8');
  const env = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) {
      let v = m[2];
      // strip surrounding quotes
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      env[m[1]] = v;
    }
  }
  return env;
}

// --- Markdown parsing ---------------------------------------------
function parseMetadataTable(md) {
  // Find the "## 메타데이터" section and parse the pipe-separated table
  const start = md.indexOf('## 메타데이터');
  if (start === -1) return null;
  const section = md.slice(start, md.indexOf('\n---', start));
  const meta = {};
  for (const line of section.split('\n')) {
    const m = line.match(/^\|\s*([a-zA-Z_]+)\s*\|\s*(.*?)\s*\|\s*$/);
    if (!m) continue;
    const key = m[1].trim();
    const val = m[2].trim();
    if (key === '필드' || val === '값' || val.startsWith('---')) continue;
    meta[key] = val;
  }
  return meta;
}

function extractBody(md) {
  const marker = '## 본문';
  const idx = md.indexOf(marker);
  if (idx === -1) return null;
  // Start from the first newline after "## 본문"
  return md.slice(idx + marker.length).trim();
}

function estimateReadingTime(text) {
  // Korean: ~500 chars/min rough
  const cleaned = text.replace(/\s+/g, '');
  return Math.max(1, Math.round(cleaned.length / 500));
}

// --- CLI invocation ------------------------------------------------
function runConvertPlate(markdownBody, topic) {
  return new Promise((resolve, reject) => {
    const args = [CLI_PATH, 'convert-plate', '--topic', topic, '--category', 'case-study'];
    const child = spawn('node', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`convert-plate exited ${code}: ${stderr}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        reject(new Error(`Failed to parse convert-plate output: ${e.message}`));
      }
    });
    child.stdin.write(markdownBody);
    child.stdin.end();
  });
}

// --- Supabase REST helpers ----------------------------------------
async function sbGet(env, path) {
  const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}: ${await res.text()}`);
  return res.json();
}

async function sbInsert(env, table, payload) {
  const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`INSERT ${table} → ${res.status}: ${await res.text()}`);
  return res.json();
}

// --- Main ---------------------------------------------------------
async function main() {
  console.error(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE INSERT'}`);
  const env = await loadEnv(ENV_FILE);
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase env vars');
  }

  if (!existsSync(CLI_PATH)) {
    throw new Error(`CLI not built: ${CLI_PATH}. Run 'pnpm --filter @awc/content-core build' first.`);
  }

  // Whitelist only the 12 target drafts (exclude WESPION-Roomfit which has different structure)
  const targets = [
    '광고대행SaaS-초안-2026-04-14.md',
    '골프아카데미-초안-2026-04-14.md',
    '마케팅대행사-초안-2026-04-16.md',
    '물류중개-초안-2026-04-17.md',
    '법무법인-초안-2026-04-16.md',
    '보험설계사-초안-2026-04-17.md',
    '뷰티이커머스-초안-2026-04-16.md',
    '빌딩중개-초안-2026-04-14.md',
    '온라인어학원-초안-2026-04-16.md',
    '인테리어시공-초안-2026-04-17.md',
    '카페프랜차이즈-초안-2026-04-16.md',
    '피부과클리닉-초안-2026-04-16.md',
  ];

  // Existing slugs to skip duplicates
  const existing = await sbGet(env, 'blog_posts?select=slug');
  const existingSlugs = new Set(existing.map((r) => r.slug));

  const prepared = [];
  for (const file of targets) {
    const full = join(DRAFTS_DIR, file);
    const md = await readFile(full, 'utf-8');
    const meta = parseMetadataTable(md);
    if (!meta) {
      console.error(`SKIP (no meta): ${file}`);
      continue;
    }
    const body = extractBody(md);
    if (!body) {
      console.error(`SKIP (no body): ${file}`);
      continue;
    }
    const title = meta.title;
    const slug = meta.slug;
    const excerpt = meta.excerpt || null;
    const meta_description = meta.meta_description || null;
    const meta_keywords = meta.meta_keywords
      ? meta.meta_keywords.split(',').map((k) => k.trim()).filter(Boolean)
      : [];
    const reading_time = meta.reading_time ? parseInt(meta.reading_time, 10) : estimateReadingTime(body);

    if (!title || !slug) {
      console.error(`SKIP (missing title/slug): ${file}`);
      continue;
    }

    if (existingSlugs.has(slug)) {
      console.error(`SKIP (slug exists): ${file} → ${slug}`);
      continue;
    }

    console.error(`Converting: ${file} → slug=${slug}`);
    const plateContent = await runConvertPlate(body, title);

    prepared.push({
      file,
      payload: {
        title,
        slug,
        excerpt,
        content: plateContent,
        meta_title: `${title} | AWC`,
        meta_description,
        meta_keywords,
        status: 'draft',
        reading_time,
        ai_generated: false,
      },
    });
  }

  console.error(`\nPrepared ${prepared.length} payloads.`);
  for (const p of prepared) {
    console.error(`  - ${p.payload.slug} — ${p.payload.title.slice(0, 60)}`);
  }

  if (DRY_RUN) {
    console.error('\nDRY RUN complete. Re-run without --dry-run to insert.');
    // Output slugs+titles as JSON for easy inspection
    console.log(JSON.stringify(prepared.map((p) => ({
      file: p.file,
      slug: p.payload.slug,
      title: p.payload.title,
      excerpt: p.payload.excerpt,
      meta_keywords: p.payload.meta_keywords,
      reading_time: p.payload.reading_time,
      plate_nodes: p.payload.content.length,
    })), null, 2));
    return;
  }

  // Live insert
  const inserted = [];
  for (const p of prepared) {
    const [row] = await sbInsert(env, 'blog_posts', p.payload);
    await sbInsert(env, 'blog_post_categories', {
      post_id: row.id,
      category_id: CATEGORY_ID_CASE_STUDY,
    });
    inserted.push({ slug: row.slug, id: row.id });
    console.error(`INSERTED: ${row.slug} (${row.id})`);
  }

  console.log(JSON.stringify({ inserted, count: inserted.length }, null, 2));
}

main().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
