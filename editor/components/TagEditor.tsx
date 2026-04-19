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
    <div className="tag-editor">
      {tags.map((t) => (
        <span key={t} className="tag-item">
          {t}
          <span className="tag-remove" onClick={() => removeTag(t)}>
            ✕
          </span>
        </span>
      ))}
      <input
        className="tag-add-input"
        placeholder={placeholder}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}
