'use client';

import { useState, useEffect, useCallback } from 'react';
import { getEditorConfig } from '@/lib/editor-config';

interface Collection {
  id: string;
  name: string;
  description?: string;
  cover_image_url?: string;
  created_at: string;
  updated_at: string;
  video_ids?: string[];
}

export default function CollectionsPanel() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const apiUrl = getEditorConfig().apiUrl;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${apiUrl}/api/references/collections`);
      const d = await r.json();
      setCollections(d.collections || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [apiUrl]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const r = await fetch(`${apiUrl}/api/references/collections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (r.ok) {
        setNewName('');
        load();
      }
    } catch { /* ignore */ }
    setCreating(false);
  };

  const handleRename = async (id: string) => {
    if (!editName.trim()) return;
    try {
      await fetch(`${apiUrl}/api/references/collections/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim() }),
      });
      setEditingId(null);
      load();
    } catch { /* ignore */ }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 컬렉션을 삭제하시겠습니까?')) return;
    try {
      await fetch(`${apiUrl}/api/references/collections/${id}`, { method: 'DELETE' });
      load();
    } catch { /* ignore */ }
  };

  return (
    <div style={{ padding: 24 }}>
      {/* Create */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <input
          type="text"
          placeholder="새 컬렉션 이름..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
          style={{
            flex: 1, background: '#111', border: '1px solid #333', borderRadius: 8,
            padding: '10px 14px', color: '#eee', fontSize: 13,
          }}
        />
        <button
          onClick={handleCreate}
          disabled={creating || !newName.trim()}
          style={{
            whiteSpace: 'nowrap', padding: '10px 16px', borderRadius: 8,
            background: '#2563eb', color: '#fff', border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 500,
          }}
        >
          {creating ? '생성 중...' : '+ 컬렉션 생성'}
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ color: '#555', fontSize: 13 }}>불러오는 중...</div>
      ) : collections.length === 0 ? (
        <div style={{ color: '#555', fontSize: 13, textAlign: 'center', padding: 40 }}>
          컬렉션이 없습니다. 위에서 새 컬렉션을 만들어보세요.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {collections.map((col) => (
            <div
              key={col.id}
              style={{
                background: '#111', borderRadius: 12, border: '1px solid #222',
                padding: 20, display: 'flex', flexDirection: 'column', gap: 8,
              }}
            >
              {editingId === col.id ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleRename(col.id); }}
                    style={{ flex: 1, background: '#0a0a0a', border: '1px solid #444', borderRadius: 6, padding: '6px 10px', color: '#eee', fontSize: 13 }}
                    autoFocus
                  />
                  <button onClick={() => handleRename(col.id)} style={{ background: '#222', border: '1px solid #333', borderRadius: 6, padding: '6px 10px', color: '#ccc', cursor: 'pointer', fontSize: 11 }}>&#x2713;</button>
                  <button onClick={() => setEditingId(null)} style={{ background: '#222', border: '1px solid #333', borderRadius: 6, padding: '6px 10px', color: '#ccc', cursor: 'pointer', fontSize: 11 }}>&#x2715;</button>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: 15, fontWeight: 600, color: '#eee', margin: 0 }}>{col.name}</h3>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      onClick={() => { setEditingId(col.id); setEditName(col.name); }}
                      style={{ background: '#222', border: '1px solid #333', borderRadius: 6, padding: '4px 8px', color: '#ccc', cursor: 'pointer', fontSize: 10 }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(col.id)}
                      style={{ background: '#222', border: '1px solid #333', borderRadius: 6, padding: '4px 8px', color: '#f88', cursor: 'pointer', fontSize: 10 }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}

              {col.description && (
                <p style={{ fontSize: 11, color: '#888', margin: 0 }}>{col.description}</p>
              )}

              <div style={{ fontSize: 10, color: '#555', marginTop: 4 }}>
                생성: {new Date(col.created_at).toLocaleDateString('ko-KR')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
