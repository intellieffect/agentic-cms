import { Transforms, Editor, Element as SlateElement, Path, Node } from 'slate';

export const ELEMENT_TABLE = 'table';
export const ELEMENT_TABLE_ROW = 'table-row';
export const ELEMENT_TABLE_CELL = 'table-cell';
export const ELEMENT_TABLE_HEADER_CELL = 'table-header-cell';

// 테이블 타입 정의
export interface TableElement {
  type: 'table';
  children: TableRowElement[];
}

export interface TableRowElement {
  type: 'table-row';
  children: (TableCellElement | TableHeaderCellElement)[];
}

export interface TableCellElement {
  type: 'table-cell';
  children: any[];
}

export interface TableHeaderCellElement {
  type: 'table-header-cell';
  children: any[];
}

// 테이블 삽입
export const insertTable = (editor: Editor, rows: number = 3, columns: number = 3) => {
  const tableRows: TableRowElement[] = [];
  
  // 헤더 행 생성
  const headerCells: TableHeaderCellElement[] = [];
  for (let i = 0; i < columns; i++) {
    headerCells.push({
      type: ELEMENT_TABLE_HEADER_CELL,
      children: [{ text: `헤더 ${i + 1}` }],
    });
  }
  tableRows.push({
    type: ELEMENT_TABLE_ROW,
    children: headerCells,
  });
  
  // 일반 행 생성
  for (let i = 1; i < rows; i++) {
    const cells: TableCellElement[] = [];
    for (let j = 0; j < columns; j++) {
      cells.push({
        type: ELEMENT_TABLE_CELL,
        children: [{ text: '' }],
      });
    }
    tableRows.push({
      type: ELEMENT_TABLE_ROW,
      children: cells,
    });
  }
  
  const table: TableElement = {
    type: ELEMENT_TABLE,
    children: tableRows,
  };
  
  Transforms.insertNodes(editor, table);
  Transforms.insertNodes(editor, {
    type: 'paragraph',
    children: [{ text: '' }],
  } as any);
};

// 현재 테이블 안에 있는지 확인
export const isInTable = (editor: Editor): boolean => {
  const [match] = Editor.nodes(editor, {
    match: n =>
      !Editor.isEditor(n) &&
      SlateElement.isElement(n) &&
      (n as any).type === ELEMENT_TABLE,
  });
  return !!match;
};

// 현재 셀 위치 찾기
export const getCurrentCellPath = (editor: Editor): Path | null => {
  const { selection } = editor;
  if (!selection) return null;

  const [cellMatch] = Editor.nodes(editor, {
    match: n =>
      !Editor.isEditor(n) &&
      SlateElement.isElement(n) &&
      ((n as any).type === ELEMENT_TABLE_CELL || (n as any).type === ELEMENT_TABLE_HEADER_CELL),
  });

  return cellMatch ? cellMatch[1] : null;
};

// 행 추가
export const insertTableRow = (editor: Editor, at?: 'before' | 'after') => {
  const { selection } = editor;
  if (!selection || !isInTable(editor)) return;

  const [rowMatch] = Editor.nodes(editor, {
    match: n =>
      !Editor.isEditor(n) &&
      SlateElement.isElement(n) &&
      (n as any).type === ELEMENT_TABLE_ROW,
  });

  if (!rowMatch) return;
  
  const [rowNode, rowPath] = rowMatch;
  const columnCount = (rowNode as TableRowElement).children.length;
  
  const newCells: TableCellElement[] = [];
  for (let i = 0; i < columnCount; i++) {
    newCells.push({
      type: ELEMENT_TABLE_CELL,
      children: [{ text: '' }],
    });
  }
  
  const newRow: TableRowElement = {
    type: ELEMENT_TABLE_ROW,
    children: newCells,
  };
  
  const insertPath = at === 'before' ? rowPath : Path.next(rowPath);
  Transforms.insertNodes(editor, newRow, { at: insertPath });
};

// 열 추가
export const insertTableColumn = (editor: Editor, at?: 'before' | 'after') => {
  const { selection } = editor;
  if (!selection || !isInTable(editor)) return;

  const cellPath = getCurrentCellPath(editor);
  if (!cellPath) return;

  const cellIndex = cellPath[cellPath.length - 1];
  const insertIndex = at === 'before' ? cellIndex : cellIndex + 1;

  const [tableMatch] = Editor.nodes(editor, {
    match: n =>
      !Editor.isEditor(n) &&
      SlateElement.isElement(n) &&
      (n as any).type === ELEMENT_TABLE,
  });

  if (!tableMatch) return;
  
  const [tableNode, tablePath] = tableMatch;
  const table = tableNode as TableElement;

  // 각 행에 새 셀 추가
  table.children.forEach((row, rowIndex) => {
    const isHeaderRow = rowIndex === 0;
    const newCell = isHeaderRow
      ? {
          type: ELEMENT_TABLE_HEADER_CELL,
          children: [{ text: '새 헤더' }],
        }
      : {
          type: ELEMENT_TABLE_CELL,
          children: [{ text: '' }],
        };
    
    const cellPath = [...tablePath, rowIndex, insertIndex];
    Transforms.insertNodes(editor, newCell, { at: cellPath });
  });
};

// 행 삭제
export const deleteTableRow = (editor: Editor) => {
  const { selection } = editor;
  if (!selection || !isInTable(editor)) return;

  const [rowMatch] = Editor.nodes(editor, {
    match: n =>
      !Editor.isEditor(n) &&
      SlateElement.isElement(n) &&
      (n as any).type === ELEMENT_TABLE_ROW,
  });

  if (!rowMatch) return;
  
  const [, rowPath] = rowMatch;
  
  // 테이블의 행이 2개 이하면 삭제 불가 (헤더 + 최소 1개 행)
  const [tableMatch] = Editor.nodes(editor, {
    match: n =>
      !Editor.isEditor(n) &&
      SlateElement.isElement(n) &&
      (n as any).type === ELEMENT_TABLE,
  });
  
  if (tableMatch) {
    const [tableNode] = tableMatch;
    if ((tableNode as TableElement).children.length <= 2) return;
  }
  
  Transforms.removeNodes(editor, { at: rowPath });
};

// 열 삭제
export const deleteTableColumn = (editor: Editor) => {
  const { selection } = editor;
  if (!selection || !isInTable(editor)) return;

  const cellPath = getCurrentCellPath(editor);
  if (!cellPath) return;

  const cellIndex = cellPath[cellPath.length - 1];

  const [tableMatch] = Editor.nodes(editor, {
    match: n =>
      !Editor.isEditor(n) &&
      SlateElement.isElement(n) &&
      (n as any).type === ELEMENT_TABLE,
  });

  if (!tableMatch) return;
  
  const [tableNode, tablePath] = tableMatch;
  const table = tableNode as TableElement;

  // 열이 1개만 남았으면 삭제 불가
  if (table.children[0].children.length <= 1) return;

  // 각 행에서 해당 인덱스의 셀 삭제
  table.children.forEach((row, rowIndex) => {
    const cellPath = [...tablePath, rowIndex, cellIndex];
    Transforms.removeNodes(editor, { at: cellPath });
  });
};