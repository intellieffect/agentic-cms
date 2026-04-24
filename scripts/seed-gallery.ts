#!/usr/bin/env tsx
/**
 * AWC Gallery 1회성 Seed — Downloads/awc-assets → Supabase Storage + gallery_items
 *
 * 사용법:
 *   cd ~/Projects/agentic-cms
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... tsx scripts/seed-gallery.ts
 *
 * 옵션:
 *   --dry      DB·Storage 쓰기 없이 매니페스트·파일 유효성만 확인
 *   --force    이미 존재하는 slug의 gallery_items도 UPDATE
 *
 * 멱등성: media.storage_path + gallery_items.slug UNIQUE 로 재실행 시 중복 insert skip.
 */

import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';
import { homedir } from 'node:os';
import { GALLERY_SEED, type GallerySeedItem } from './seed-gallery.manifest.js';

// ── config ────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry');
const FORCE = process.argv.includes('--force');

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('ERROR: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY env 필요');
  process.exit(1);
}

const ASSET_DIR = resolve(homedir(), 'Downloads/awc-assets');
const BUCKET = 'content-media';

// ── helpers ────────────────────────────────────────────────────────
const MIME_MAP: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
};

function mimeFor(filename: string): string {
  const ext = extname(filename).toLowerCase();
  return MIME_MAP[ext] ?? 'application/octet-stream';
}

function storagePathFor(slug: string, filename: string): string {
  const ext = extname(filename).toLowerCase();
  return `gallery-seed/${slug}${ext}`;
}

function log(label: string, ...args: unknown[]) {
  const tag = DRY_RUN ? '[DRY]' : '[SEED]';
  console.log(`${tag} ${label}`, ...args);
}

// ── main ────────────────────────────────────────────────────────
async function main() {
  const sb = createClient(SUPABASE_URL!, SERVICE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  log(`manifest: ${GALLERY_SEED.length} items | asset dir: ${ASSET_DIR}`);

  let ok = 0;
  let skipped = 0;
  let failed = 0;

  for (const item of GALLERY_SEED) {
    try {
      const localPath = resolve(ASSET_DIR, item.filename);
      if (!existsSync(localPath)) {
        log(`SKIP (file missing): ${item.filename}`);
        skipped++;
        continue;
      }

      const storagePath = storagePathFor(item.slug, item.filename);
      const mime = mimeFor(item.filename);
      const fileSize = statSync(localPath).size;

      // 1) Storage 업로드 (멱등: upsert:false 로 duplicate 시 error → skip)
      let storageUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;
      if (!DRY_RUN) {
        const buffer = readFileSync(localPath);
        const { error: uploadErr } = await sb.storage
          .from(BUCKET)
          .upload(storagePath, buffer, {
            contentType: mime,
            upsert: FORCE,
          });
        if (uploadErr && !uploadErr.message.includes('already exists')) {
          throw new Error(`upload ${item.slug}: ${uploadErr.message}`);
        }
      }
      log(`storage OK: ${item.slug} → ${storagePath} (${(fileSize / 1024 / 1024).toFixed(1)}MB)`);

      // 2) media row 확보 (slug 로 조회 후 없으면 insert)
      let mediaId: string | null = null;
      if (!DRY_RUN) {
        const { data: existingMedia } = await sb
          .from('media')
          .select('id')
          .eq('storage_path', storagePath)
          .maybeSingle();
        if (existingMedia?.id) {
          mediaId = existingMedia.id;
        } else {
          const { data: newMedia, error: mediaErr } = await sb
            .from('media')
            .insert({
              filename: basename(item.filename),
              mime_type: mime,
              file_size: fileSize,
              url: storageUrl,
              storage_path: storagePath,
              caption: item.subtitle ?? null,
              alt_text: item.title,
              created_by: 'seed:gallery',
            })
            .select('id')
            .single();
          if (mediaErr) throw new Error(`media insert ${item.slug}: ${mediaErr.message}`);
          mediaId = newMedia.id;
        }
      }

      // 3) gallery_items row (멱등: slug UNIQUE)
      if (!DRY_RUN) {
        const payload = {
          slug: item.slug,
          title: item.title,
          subtitle: item.subtitle ?? null,
          summary: item.summary ?? null,
          kind: item.kind,
          cover_media_id: mediaId,
          cover_aspect: item.cover_aspect,
          status: 'published' as const,
          visibility: item.visibility ?? 'public',
          is_featured: item.is_featured,
          featured_rank: item.featured_rank ?? null,
          published_at: new Date().toISOString(),
          featured_at: item.is_featured ? new Date().toISOString() : null,
          tags: item.tags,
          brand: 'awc',
          author: item.author ?? 'Agentic Workflow',
          duration_minutes: item.duration_minutes,
          source_label: 'Agentic Workflow',
          metrics: {},
        };

        const { data: existing } = await sb
          .from('gallery_items')
          .select('id')
          .eq('slug', item.slug)
          .maybeSingle();

        let itemId: string;
        if (existing?.id) {
          if (FORCE) {
            const { error: updErr } = await sb
              .from('gallery_items')
              .update(payload)
              .eq('id', existing.id);
            if (updErr) throw new Error(`gallery_items update: ${updErr.message}`);
            log(`gallery_items UPDATE: ${item.slug}`);
          } else {
            log(`gallery_items EXISTS (no --force): ${item.slug}`);
          }
          itemId = existing.id;
        } else {
          const { data: inserted, error: insErr } = await sb
            .from('gallery_items')
            .insert(payload)
            .select('id')
            .single();
          if (insErr) throw new Error(`gallery_items insert: ${insErr.message}`);
          itemId = inserted.id;
          log(`gallery_items INSERT: ${item.slug}`);
        }

        // 4) gallery_item_media link (cover role, 1건)
        const { data: existingLink } = await sb
          .from('gallery_item_media')
          .select('id')
          .eq('item_id', itemId)
          .eq('media_id', mediaId!)
          .maybeSingle();
        if (!existingLink) {
          const { error: linkErr } = await sb.from('gallery_item_media').insert({
            item_id: itemId,
            media_id: mediaId,
            role: 'cover',
            sort_order: 0,
          });
          if (linkErr) throw new Error(`gallery_item_media insert: ${linkErr.message}`);
        }
      }

      ok++;
    } catch (e) {
      failed++;
      console.error(`FAIL [${item.slug}]`, e instanceof Error ? e.message : e);
    }
  }

  console.log(`\n── Seed 완료: ok=${ok} skipped=${skipped} failed=${failed} (dry=${DRY_RUN})`);
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
