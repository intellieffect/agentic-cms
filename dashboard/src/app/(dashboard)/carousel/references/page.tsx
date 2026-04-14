'use client'

import { useState, useEffect, useCallback } from 'react'
import { getEditorConfig } from '@/lib/editor-config'

// 메모리 캐시 (페이지 전환해도 유지)
const cache: Record<string, { data: unknown; ts: number }> = {}
const CACHE_TTL = 5 * 60 * 1000 // 5분

async function cachedFetch(url: string) {
  const now = Date.now()
  if (cache[url] && now - cache[url].ts < CACHE_TTL) return cache[url].data
  const res = await fetch(url)
  const data = await res.json()
  cache[url] = { data, ts: now }
  return data
}

interface Post {
  id: string
  account_id: string
  post_date: string
  post_type: string
  slide_count: number
  like_count: number
  comment_count: number
  caption: string
  layout_pattern: string | null
  hook_type: string | null
  cta_type: string | null
  topic_tags: string | null
  style_tags: string[] | null
  notes: string | null
  slides?: Slide[]
}

interface Slide {
  id: number
  post_id: string
  slide_index: number
  image_path: string
  template_type: string | null
  text_content: string | null
  notes: string | null
}

interface Account {
  id: string
  display_name: string | null
  platform: string | null
  category: string | null
  follower_count: number | null
}

const LAYOUT_OPTIONS = ['list', 'step-by-step', 'compare', 'quote', 'tips', 'tutorial', 'story', 'stat-highlight', 'problem-solution']
const HOOK_OPTIONS = ['question', 'stat', 'problem', 'teaser', 'bold-claim']
const CTA_OPTIONS = ['comment-dm', 'follow', 'save', 'link', 'none']
const SORT_OPTIONS = [
  { value: 'latest', label: '최신순' },
  { value: 'likes', label: '좋아요순' },
  { value: 'comments', label: '댓글순' },
]

export default function CarouselReferencesPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  // Filters
  const [accountFilter, setAccountFilter] = useState('')
  const [layoutFilter, setLayoutFilter] = useState('')
  const [hookFilter, setHookFilter] = useState('')
  const [ctaFilter, setCtaFilter] = useState('')
  const [sortBy, setSortBy] = useState('latest')

  // Modal
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<Record<string, string>>({})

  const apiUrl = getEditorConfig().apiUrl

  function slideImageUrl(postId: string, idx: number) {
    return `${apiUrl}/api/ref-posts/${postId}/slides/${idx}/image`
  }

  const fetchAccounts = useCallback(async () => {
    try {
      const data = await cachedFetch(`${apiUrl}/api/ref-posts/accounts`) as { accounts?: Account[] }
      setAccounts(data.accounts || [])
    } catch { /* ignore */ }
  }, [apiUrl])

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('post_type', 'carousel')
      if (accountFilter) params.set('account_id', accountFilter)
      if (layoutFilter) params.set('layout_pattern', layoutFilter)
      if (hookFilter) params.set('hook_type', hookFilter)
      if (ctaFilter) params.set('cta_type', ctaFilter)
      params.set('sort', sortBy)
      params.set('limit', '60')
      const data = await cachedFetch(`${apiUrl}/api/ref-posts?${params}`) as { posts?: Post[]; total?: number }
      setPosts(data.posts || [])
      setTotal(data.total || 0)
    } catch { /* ignore */ }
    setLoading(false)
  }, [accountFilter, layoutFilter, hookFilter, ctaFilter, sortBy, apiUrl])

  useEffect(() => { fetchAccounts() }, [fetchAccounts])
  useEffect(() => { fetchPosts() }, [fetchPosts])

  const openPost = async (postId: string) => {
    try {
      const res = await fetch(`${apiUrl}/api/ref-posts/${postId}`)
      const data = await res.json()
      setSelectedPost(data)
      setEditing(false)
    } catch { /* ignore */ }
  }

  const startEdit = () => {
    if (!selectedPost) return
    setEditForm({
      layout_pattern: selectedPost.layout_pattern ?? '',
      hook_type: selectedPost.hook_type ?? '',
      cta_type: selectedPost.cta_type ?? '',
      topic_tags: selectedPost.topic_tags ?? '',
      notes: selectedPost.notes ?? '',
    })
    setEditing(true)
  }

  const saveEdit = async () => {
    if (!selectedPost) return
    await fetch(`${apiUrl}/api/ref-posts/${selectedPost.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    })
    setEditing(false)
    fetchPosts()
    openPost(selectedPost.id)
  }

  return (
    <>
      <div className="top-bar">
        <span className="top-bar-title">캐러셀 레퍼런스</span>
        <div className="sep" />
        <span style={{ fontSize: 12, color: '#666' }}>{total}개 포스트</span>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        {/* Filters */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20, alignItems: 'center' }}>
          {/* Account chips */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <select
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              style={{
                padding: '6px 12px', borderRadius: 8, border: '1px solid #333',
                background: '#141414', color: '#ccc', fontSize: 12, cursor: 'pointer', outline: 'none',
              }}
            >
              <option value="">전체 계정</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>@{a.display_name || a.id}</option>
              ))}
            </select>
          </div>

          {/* Dropdowns */}
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <FilterSelect label="레이아웃" value={layoutFilter} onChange={setLayoutFilter} options={LAYOUT_OPTIONS} />
            <FilterSelect label="훅" value={hookFilter} onChange={setHookFilter} options={HOOK_OPTIONS} />
            <FilterSelect label="CTA" value={ctaFilter} onChange={setCtaFilter} options={CTA_OPTIONS} />
            <FilterSelect
              label="정렬"
              value={sortBy}
              onChange={setSortBy}
              options={SORT_OPTIONS.map((s) => s.value)}
              labels={SORT_OPTIONS.map((s) => s.label)}
            />
          </div>
        </div>

        {/* Post list */}
        {loading ? (
          <div style={{ color: '#666', textAlign: 'center', padding: 80, fontSize: 13 }}>불러오는 중...</div>
        ) : posts.length === 0 ? (
          <div style={{ color: '#555', textAlign: 'center', padding: 80, fontSize: 13 }}>레퍼런스가 없습니다.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {posts.map((post) => (
              <div
                key={post.id}
                style={{ background: '#111', borderRadius: 12, overflow: 'hidden' }}
              >
                {/* Post header */}
                <div
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 16px', borderBottom: '1px solid #1a1a1a',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#fafafa' }}>@{post.account_id}</span>
                    <span style={{ fontSize: 11, color: '#666' }}>{post.post_date}</span>
                    <span style={{ fontSize: 11, color: '#666' }}>{post.like_count?.toLocaleString()} likes</span>
                    <span style={{ fontSize: 11, color: '#666' }}>{post.comment_count?.toLocaleString()} comments</span>
                    <span style={{ fontSize: 11, color: '#555' }}>{post.slide_count}장</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {post.layout_pattern && <Badge text={post.layout_pattern} color="#2563eb" />}
                    {post.hook_type && <Badge text={post.hook_type} color="#7c3aed" />}
                    {post.cta_type && <Badge text={post.cta_type} color="#059669" />}
                    <button
                      onClick={() => openPost(post.id)}
                      style={{
                        marginLeft: 8, padding: '4px 10px', fontSize: 11,
                        background: '#1a1a1a', border: 'none', borderRadius: 8,
                        color: '#888', cursor: 'pointer',
                      }}
                    >
                      상세
                    </button>
                  </div>
                </div>

                {/* Slide thumbnails */}
                <div style={{ overflowX: 'auto', padding: 12 }}>
                  <div style={{ display: 'flex', gap: 10, minWidth: 'min-content' }}>
                    {Array.from({ length: Math.min(post.slide_count, 6) }, (_, i) => (
                      <div key={i} style={{ flexShrink: 0, position: 'relative', maxWidth: 280 }}>
                        <img
                          src={slideImageUrl(post.id, i + 1)}
                          alt={`Slide ${i + 1}`}
                          loading="lazy"
                          style={{
                            width: 280, height: 'auto', objectFit: 'contain',
                            borderRadius: 8, background: '#000', display: 'block',
                          }}
                        />
                        <span
                          style={{
                            position: 'absolute', top: 6, left: 6,
                            background: 'rgba(0,0,0,0.7)', padding: '1px 6px',
                            borderRadius: 4, fontSize: 10, color: '#ddd',
                          }}
                        >
                          {i + 1}
                        </span>
                      </div>
                    ))}
                    {post.slide_count > 6 && (
                      <div
                        onClick={(e) => { e.stopPropagation(); openPost(post.id); }}
                        style={{
                          flexShrink: 0, width: 280, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          borderRadius: 8, background: '#141414', border: '1px solid #333', cursor: 'pointer',
                          fontSize: 13, color: '#888', minHeight: 200,
                        }}
                      >
                        +{post.slide_count - 6}장 더보기
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selectedPost && (
        <div
          onClick={() => setSelectedPost(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column',
          }}
        >
          {/* Top bar */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 24px', flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#fafafa' }}>@{selectedPost.account_id}</span>
              <span style={{ fontSize: 12, color: '#888' }}>{selectedPost.post_date} · {selectedPost.slide_count}장</span>
              <span style={{ fontSize: 12, color: '#ccc' }}>{selectedPost.like_count?.toLocaleString()} likes</span>
              <span style={{ fontSize: 12, color: '#ccc' }}>{selectedPost.comment_count?.toLocaleString()} comments</span>
              {selectedPost.layout_pattern && <Badge text={selectedPost.layout_pattern} color="#2563eb" />}
              {selectedPost.hook_type && <Badge text={selectedPost.hook_type} color="#7c3aed" />}
              {selectedPost.cta_type && <Badge text={selectedPost.cta_type} color="#059669" />}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={startEdit}
                style={{
                  padding: '6px 12px', fontSize: 12, background: '#1a1a1a',
                  border: 'none', borderRadius: 8, color: '#ccc', cursor: 'pointer',
                }}
              >
                태그 편집
              </button>
              <button
                onClick={() => setSelectedPost(null)}
                style={{
                  fontSize: 20, background: 'none', border: 'none',
                  color: '#666', cursor: 'pointer',
                }}
              >
                X
              </button>
            </div>
          </div>

          {/* Slides */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', padding: '0 24px 16px' }}
          >
            <div style={{ display: 'flex', gap: 12, height: '100%', alignItems: 'center', minWidth: 'min-content' }}>
              {Array.from({ length: selectedPost.slide_count }, (_, i) => (
                <div key={i} style={{ flexShrink: 0, height: 'calc(100vh - 140px)', position: 'relative' }}>
                  <img
                    src={slideImageUrl(selectedPost.id, i + 1)}
                    alt={`Slide ${i + 1}`}
                    loading="lazy"
                    style={{ height: '100%', width: 'auto', objectFit: 'contain', borderRadius: 10 }}
                  />
                  <span
                    style={{
                      position: 'absolute', top: 8, left: 8,
                      background: 'rgba(0,0,0,0.7)', padding: '2px 8px',
                      borderRadius: 4, fontSize: 11, color: '#ddd',
                    }}
                  >
                    {i + 1}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Caption */}
          {selectedPost.caption && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ padding: '0 24px 16px', flexShrink: 0 }}
            >
              <div
                style={{
                  fontSize: 13, color: '#aaa', background: '#111',
                  padding: 12, borderRadius: 10, maxWidth: 700,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >
                {selectedPost.caption.slice(0, 200)}
              </div>
            </div>
          )}

          {/* Edit overlay */}
          {editing && (
            <div
              onClick={() => setEditing(false)}
              style={{
                position: 'fixed', inset: 0, zIndex: 60,
                background: 'rgba(0,0,0,0.6)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: '#111', borderRadius: 16, padding: 24, width: 380,
                  display: 'flex', flexDirection: 'column', gap: 12,
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 700, color: '#fafafa', marginBottom: 4 }}>태그 편집</div>
                <EditField label="레이아웃" field="layout_pattern" options={LAYOUT_OPTIONS} form={editForm} setForm={setEditForm} />
                <EditField label="훅" field="hook_type" options={HOOK_OPTIONS} form={editForm} setForm={setEditForm} />
                <EditField label="CTA" field="cta_type" options={CTA_OPTIONS} form={editForm} setForm={setEditForm} />
                <div>
                  <label style={{ fontSize: 11, color: '#666', display: 'block', marginBottom: 4 }}>토픽 (쉼표 구분)</label>
                  <input
                    value={editForm.topic_tags || ''}
                    onChange={(e) => setEditForm({ ...editForm, topic_tags: e.target.value })}
                    style={{
                      width: '100%', padding: '6px 10px', fontSize: 13,
                      background: '#0a0a0a', border: '1px solid #333',
                      borderRadius: 6, color: '#ccc', outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#666', display: 'block', marginBottom: 4 }}>메모</label>
                  <textarea
                    value={editForm.notes || ''}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    style={{
                      width: '100%', padding: '6px 10px', fontSize: 13, height: 80, resize: 'none',
                      background: '#0a0a0a', border: '1px solid #333',
                      borderRadius: 6, color: '#ccc', outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={saveEdit}
                    style={{
                      flex: 1, padding: '8px 0', fontSize: 13, fontWeight: 600,
                      background: '#ff6b35', border: 'none', borderRadius: 8,
                      color: '#fff', cursor: 'pointer',
                    }}
                  >
                    저장
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    style={{
                      flex: 1, padding: '8px 0', fontSize: 13,
                      background: '#1a1a1a', border: 'none', borderRadius: 8,
                      color: '#ccc', cursor: 'pointer',
                    }}
                  >
                    취소
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span
      style={{
        padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 500,
        background: color + '22', color,
      }}
    >
      {text}
    </span>
  )
}

function FilterSelect({
  label, value, onChange, options, labels,
}: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; labels?: string[]
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        padding: '5px 10px', fontSize: 12, borderRadius: 8,
        background: '#1a1a1a', border: '1px solid #333', color: '#ccc', outline: 'none',
      }}
    >
      <option value="">{label}</option>
      {options.map((o, i) => (
        <option key={o} value={o}>{labels?.[i] ?? o}</option>
      ))}
    </select>
  )
}

function EditField({
  label, field, options, form, setForm,
}: {
  label: string; field: string; options: string[]
  form: Record<string, string>; setForm: (f: Record<string, string>) => void
}) {
  return (
    <div>
      <label style={{ fontSize: 11, color: '#666', display: 'block', marginBottom: 4 }}>{label}</label>
      <select
        value={form[field] || ''}
        onChange={(e) => setForm({ ...form, [field]: e.target.value })}
        style={{
          width: '100%', padding: '6px 10px', fontSize: 13,
          background: '#0a0a0a', border: '1px solid #333',
          borderRadius: 6, color: '#ccc', outline: 'none',
        }}
      >
        <option value="">-</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}
