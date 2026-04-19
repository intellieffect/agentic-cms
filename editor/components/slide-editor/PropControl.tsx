"use client";

import type { PropSchema } from "@/lib/studio/slide-templates";

const inputBase: React.CSSProperties = {
  width: '100%',
  background: '#0a0a0a',
  border: '1px solid #222',
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 14,
  color: '#ccc',
  outline: 'none',
};

const textareaBase: React.CSSProperties = {
  ...inputBase,
  resize: 'vertical' as const,
};

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  color: '#555',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  display: 'block',
  marginBottom: 4,
};

export function PropControl({
  propKey,
  schema,
  value,
  onChange,
  allProps,
}: {
  propKey: string;
  schema: PropSchema;
  value: any;
  onChange: (v: any) => void;
  allProps?: Record<string, any>;
}) {
  const isDisabled = value === null;
  const isOptional = !schema.required && schema.group !== 'style';

  const label = (
    <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span>
        {schema.label}
        {schema.required && <span style={{ color: '#ff6b6b', marginLeft: 4 }}>*</span>}
      </span>
      {isOptional && (
        <button
          type="button"
          onClick={() => {
            if (isDisabled) {
              // 재활성화: 타입에 맞는 기본 빈 값
              const type = schema.type || 'string';
              if (type.includes('[]')) onChange([]);
              else if (type === 'boolean') onChange(false);
              else if (type === 'number') onChange(0);
              else onChange('');
            } else {
              onChange(null);
            }
          }}
          style={{
            background: 'transparent',
            border: 'none',
            fontSize: 10,
            fontWeight: 500,
            color: isDisabled ? '#ff6b6b' : '#888',
            cursor: 'pointer',
            padding: '0 2px',
          }}
        >
          {isDisabled ? '사용하기' : '사용안함'}
        </button>
      )}
    </label>
  );

  // 사용안함 상태면 비활성 표시만
  if (isDisabled) {
    return (
      <div style={{ opacity: 0.35 }}>
        {label}
        <div style={{
          padding: '8px 12px',
          fontSize: 12,
          color: '#444',
          background: '#0a0a0a',
          border: '1px solid #1a1a1a',
          borderRadius: 8,
          fontStyle: 'italic',
        }}>
          사용하지 않는 필드입니다
        </div>
      </div>
    );
  }

  if (schema.type === "enum" && schema.options) {
    const current = value ?? schema.default ?? schema.options[0]?.value;
    return (
      <div>
        {label}
        <div style={{ display: 'flex', gap: 4 }}>
          {schema.options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              style={{
                flex: 1,
                padding: '6px 0',
                fontSize: 12,
                fontWeight: current === opt.value ? 600 : 400,
                color: current === opt.value ? '#fff' : '#888',
                background: current === opt.value ? '#ff6b6b' : '#1a1a1a',
                border: `1px solid ${current === opt.value ? '#ff6b6b' : '#333'}`,
                borderRadius: 6,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (schema.type === "boolean") {
    const checked = value ?? schema.default ?? false;
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
        <span style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{schema.label}</span>
        <button
          type="button"
          onClick={() => onChange(!checked)}
          style={{
            position: 'relative',
            width: 36,
            height: 20,
            borderRadius: 10,
            border: 'none',
            background: checked ? '#ff6b6b' : '#333',
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 2,
              left: checked ? 18 : 2,
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: '#fff',
              transition: 'left 0.2s',
            }}
          />
        </button>
      </div>
    );
  }

  if (schema.type === "number") {
    const numValue = value ?? schema.default ?? 0;
    return (
      <div>
        {label}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input
            type="range"
            min={schema.min ?? 0}
            max={schema.max ?? 300}
            step={schema.step ?? 1}
            value={numValue}
            onChange={(e) => onChange(Number(e.target.value))}
            style={{ flex: 1, cursor: 'pointer', accentColor: '#ff6b6b' }}
          />
          <input
            type="number"
            min={schema.min}
            max={schema.max}
            step={schema.step}
            value={numValue}
            onChange={(e) => onChange(Number(e.target.value))}
            style={{
              width: 64,
              background: '#0a0a0a',
              border: '1px solid #222',
              borderRadius: 6,
              padding: '4px 8px',
              fontSize: 12,
              color: '#ccc',
              textAlign: 'center',
              fontFamily: 'monospace',
              outline: 'none',
            }}
          />
        </div>
      </div>
    );
  }

  if (schema.type === "color") {
    return (
      <div>
        {label}
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="color"
            value={value || "#ff6b6b"}
            onChange={(e) => onChange(e.target.value)}
            style={{ width: 40, height: 32, borderRadius: 4, border: '1px solid #222', cursor: 'pointer', background: 'transparent' }}
          />
          <input
            type="text"
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            style={{ ...inputBase, flex: 1, width: 'auto', fontFamily: 'monospace' }}
          />
        </div>
      </div>
    );
  }

  if (schema.type === "image") {
    return (
      <div>
        {label}
        <input
          type="text"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="이미지 URL"
          style={inputBase}
        />
      </div>
    );
  }

  if (schema.type === "boolean[]" && schema.linkedTo) {
    const checks: boolean[] = Array.isArray(value) ? value : [];
    const linkedItems: string[] = Array.isArray(allProps?.[schema.linkedTo]) ? allProps[schema.linkedTo] : [];
    return (
      <div>
        {label}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {linkedItems.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                onClick={() => {
                  const next = [...checks];
                  while (next.length < linkedItems.length) next.push(true);
                  next[idx] = !next[idx];
                  onChange(next);
                }}
                style={{
                  width: 22, height: 22, minWidth: 22, borderRadius: 5, cursor: 'pointer',
                  border: checks[idx] !== false ? 'none' : '2px solid #555',
                  background: checks[idx] !== false ? (allProps?.accentColor || '#ff6b6b') : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {checks[idx] !== false && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                )}
              </div>
              <span style={{ fontSize: 12, color: '#aaa' }}>{item}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (schema.type === "string[]") {
    const lines = Array.isArray(value) ? value.map((item) => String(item ?? "")).join("\n") : String(value ?? "");
    return (
      <div>
        {label}
        <textarea
          value={lines}
          onChange={(e) =>
            onChange(
              e.target.value.split("\n")
            )
          }
          rows={5}
          placeholder="한 줄에 한 항목씩 입력"
          style={textareaBase}
        />
      </div>
    );
  }

  if (schema.type === "object[]|string[]") {
    // objectFields가 정의되어 있으면 폼 UI 렌더링
    if (schema.objectFields?.length) {
      const fields = schema.objectFields;
      const items: Record<string, any>[] = Array.isArray(value) ? value.map((v) => {
        if (typeof v === 'object' && v !== null) return v;
        if (typeof v === 'string' && fields.length > 0) return { [fields[0].key]: v };
        return {};
      }) : [];

      const updateItem = (idx: number, key: string, val: any) => {
        const next = items.map((item, i) => i === idx ? { ...item, [key]: val } : item);
        onChange(next);
      };
      const removeItem = (idx: number) => {
        onChange(items.filter((_, i) => i !== idx));
      };
      const addItem = () => {
        const empty: Record<string, any> = {};
        for (const f of fields) empty[f.key] = f.type === 'number' ? 0 : '';
        onChange([...items, empty]);
      };

      return (
        <div>
          {label}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map((item, idx) => (
              <div key={idx} style={{ background: '#111', border: '1px solid #222', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 10, color: '#555' }}>#{idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    style={{ background: 'transparent', border: 'none', color: '#555', fontSize: 12, cursor: 'pointer', padding: '0 4px' }}
                  >✕</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: fields.length <= 2 ? '1fr 1fr' : fields.length === 3 ? '1fr 1fr 1fr' : '1fr 1fr', gap: 6 }}>
                  {fields.map((f) => (
                    <div key={f.key}>
                      <span style={{ fontSize: 9, color: '#444', display: 'block', marginBottom: 2 }}>{f.label}</span>
                      {f.type === 'enum' && f.options ? (
                        <div style={{ display: 'flex', gap: 2 }}>
                          {f.options.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => updateItem(idx, f.key, opt.value)}
                              style={{
                                flex: 1,
                                padding: '5px 0',
                                fontSize: 11,
                                fontWeight: (item[f.key] ?? 'none') === opt.value ? 600 : 400,
                                color: (item[f.key] ?? 'none') === opt.value ? '#fff' : '#666',
                                background: (item[f.key] ?? 'none') === opt.value ? '#ff6b6b' : '#0a0a0a',
                                border: `1px solid ${(item[f.key] ?? 'none') === opt.value ? '#ff6b6b' : '#222'}`,
                                borderRadius: 5,
                                cursor: 'pointer',
                              }}
                            >{opt.label}</button>
                          ))}
                        </div>
                      ) : (
                        <input
                          type={f.type === 'number' ? 'number' : 'text'}
                          value={item[f.key] ?? (f.type === 'number' ? 0 : '')}
                          onChange={(e) => updateItem(idx, f.key, f.type === 'number' ? Number(e.target.value) : e.target.value)}
                          style={{ ...inputBase, padding: '5px 8px', fontSize: 12 }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addItem}
              style={{ width: '100%', padding: '6px 0', fontSize: 12, color: '#888', background: '#111', border: '1px dashed #333', borderRadius: 8, cursor: 'pointer' }}
            >+ 항목 추가</button>
          </div>
        </div>
      );
    }

    // fallback: JSON/텍스트 입력
    const serialized = Array.isArray(value)
      ? value.every((item) => typeof item === "string")
        ? value.join("\n")
        : JSON.stringify(value, null, 2)
      : "";
    return (
      <div>
        {label}
        <textarea
          value={serialized}
          onChange={(e) => {
            const raw = e.target.value.trim();
            if (!raw) {
              onChange([]);
              return;
            }
            try {
              onChange(JSON.parse(raw));
            } catch {
              onChange(
                raw
                  .split("\n")
                  .map((line) => line.trim())
                  .filter(Boolean)
              );
            }
          }}
          rows={6}
          placeholder='문자열 배열은 줄바꿈으로, 객체 배열은 JSON으로 입력'
          style={textareaBase}
        />
      </div>
    );
  }

  // string (default)
  if (schema.type === "string") {
    const strValue = typeof value === "string" ? value : String(value ?? "");
    const isLong = schema.multiline || strValue.length > 60 || strValue.includes("\n");
    const ph = `${schema.label}을(를) 입력하세요${schema.required ? '' : ' (선택사항)'}`;
    return (
      <div>
        {label}
        {isLong ? (
          <textarea
            value={strValue}
            onChange={(e) => onChange(e.target.value)}
            rows={4}
            style={textareaBase}
            placeholder={ph}
          />
        ) : (
          <input
            type="text"
            value={strValue}
            onChange={(e) => onChange(e.target.value)}
            style={inputBase}
            placeholder={ph}
          />
        )}
      </div>
    );
  }

  return null;
}
