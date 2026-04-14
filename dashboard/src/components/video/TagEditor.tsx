'use client';

import { useState, KeyboardEvent } from 'react';

interface TagEditorProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}

export default function TagEditor({ tags, onChange, placeholder = '+ 추가' }: TagEditorProps) {
  const [input, setInput] = useState('');

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = input.replace(/,/g, '').trim();
      if (val && !tags.includes(val)) {
        onChange([...tags, val]);
      }
      setInput('');
    }
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
      {tags.map((t) => (
        <span key={t} style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '2px 8px', borderRadius: 10, fontSize: 10,
          background: '#1a1a2a', border: '1px solid #2563eb33', color: '#60a5fa',
        }}>
          {t}
          <span
            style={{ cursor: 'pointer', color: '#888', fontSize: 10 }}
            onClick={() => removeTag(t)}
          >
            &#x2715;
          </span>
        </span>
      ))}
      <input
        style={{
          background: 'transparent', border: 'none', color: '#ccc',
          fontSize: 11, padding: '4px 6px', outline: 'none', minWidth: 60,
        }}
        placeholder={placeholder}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}
