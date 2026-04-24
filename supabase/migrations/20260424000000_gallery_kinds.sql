-- AWC Gallery — 다중 카테고리 지원 (kind 단일 → kinds text[])
-- 사용자 요구: 한 콘텐츠가 여러 kind 탭 (영상/광고/이미지/랜딩 등)에 동시 노출.
--
-- 호환성 전략: 기존 `kind` 컬럼 유지 + 신규 `kinds text[]` 추가 + 양방향 트리거.
--   - 구코드 (`SELECT kind`, `WHERE kind=...`) 그대로 작동
--   - 신코드 (`SELECT kinds`, `WHERE kinds @> ARRAY[...]`) 작동
--   - kind = kinds[1] (primary), 둘 중 하나만 변경해도 다른 쪽 자동 sync
--
-- 이 트리거는 cleanup 마이그레이션 (kind 컬럼 삭제) 시점에 함께 제거.

-- 1) kinds 컬럼 추가 + 기존 데이터 백필
alter table gallery_items add column kinds text[] default '{}';
update gallery_items set kinds = ARRAY[kind] where cardinality(kinds) = 0;
alter table gallery_items alter column kinds set not null;

-- 2) 각 원소가 enum 안에 있는지 검증
alter table gallery_items add constraint gallery_items_kinds_valid check (
  cardinality(kinds) >= 1
  and kinds <@ ARRAY['landing','video','ad','image','carousel','case_study','other']::text[]
);

-- 3) GIN 인덱스 — 다중 kind 필터(`@>`, `&&`) 지원
create index idx_gallery_items_kinds on gallery_items using gin(kinds);

-- 4) 양방향 동기화 트리거
--   - kind 만 변경 → kinds[1] = 새 kind (기존 kinds 보존하지 않고 단일로 reset)
--   - kinds 만 변경 → kind = kinds[1]
--   - 둘 다 변경 → kinds 우선 적용
--   - INSERT 시 kinds 비어있으면 ARRAY[kind] 로 초기화
create or replace function fn_gallery_kinds_sync()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    if NEW.kinds is null or cardinality(NEW.kinds) = 0 then
      NEW.kinds := ARRAY[NEW.kind];
    else
      NEW.kind := NEW.kinds[1];
    end if;
    return NEW;
  end if;

  -- UPDATE: 무엇이 바뀌었는지로 우선순위 결정
  if NEW.kinds is distinct from OLD.kinds then
    NEW.kind := NEW.kinds[1];
  elsif NEW.kind is distinct from OLD.kind then
    NEW.kinds := ARRAY[NEW.kind];
  end if;
  return NEW;
end;
$$ language plpgsql;

create trigger trg_gallery_kinds_sync
  before insert or update on gallery_items
  for each row execute function fn_gallery_kinds_sync();
