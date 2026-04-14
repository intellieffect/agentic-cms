'use client';

import React from 'react';
import { useEditorStore } from './store';

export const ExportPanel: React.FC = () => {
  const globalSubs = useEditorStore((s) => s.globalSubs);
  const exportSrt = useEditorStore((s) => s.exportSrt);
  const getProjectData = useEditorStore((s) => s.getProjectData);

  const handleExportJson = () => {
    const data = getProjectData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.name || 'project'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: '#888', textTransform: 'uppercase' }}>
        내보내기
      </div>

      {/* SRT Export */}
      <div style={{ padding: 10, background: '#1a1a1a', borderRadius: 6, border: '1px solid #2a2a2a' }}>
        <div style={{ fontSize: 11, color: '#ccc', marginBottom: 6 }}>SRT 자막 파일</div>
        <div style={{ fontSize: 9, color: '#666', marginBottom: 8 }}>
          {globalSubs.length}개 자막을 SRT 형식으로 내보냅니다
        </div>
        <button
          className="btn btn-pri"
          style={{ fontSize: 10, padding: '5px 12px', width: '100%' }}
          onClick={exportSrt}
          disabled={globalSubs.length === 0}
        >
          SRT 다운로드
        </button>
      </div>

      {/* JSON Export */}
      <div style={{ padding: 10, background: '#1a1a1a', borderRadius: 6, border: '1px solid #2a2a2a' }}>
        <div style={{ fontSize: 11, color: '#ccc', marginBottom: 6 }}>프로젝트 JSON</div>
        <div style={{ fontSize: 9, color: '#666', marginBottom: 8 }}>
          전체 프로젝트 데이터를 JSON으로 내보냅니다
        </div>
        <button
          className="btn"
          style={{ fontSize: 10, padding: '5px 12px', width: '100%' }}
          onClick={handleExportJson}
        >
          JSON 다운로드
        </button>
      </div>
    </div>
  );
};
