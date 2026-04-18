import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// 프로세스 수명동안 단일 Supabase 클라이언트를 공유.
//
// 왜 공용화 했나:
//   blog-posts.ts / carousels.ts / newsletter.ts 가 각자 createClient 를 호출해서
//   프로세스에 같은 URL/key 로 된 클라이언트 인스턴스가 여러 개 생겼었음. 기능상 무해하지만
//   1) 환경변수 누락 검증 로직이 곳곳에 반복되고
//   2) 향후 auth 헤더/옵션 변경 시 모든 파일을 수정해야 하는 부담.
//   여기에 한 번만 두고 공유.

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set before calling getSupabase().',
    );
  }

  client = createClient(url, key);
  return client;
}
