'use client';

import {TableCellHeaderPlugin, TableCellPlugin, TablePlugin, TableRowPlugin,} from '@platejs/table/react';

import {TableElement} from '@/components/ui/table-element';
import {TableRowElement} from '@/components/ui/table-row-element';
import {TableCellElement, TableCellHeaderElement} from '@/components/ui/table-cell-element';

export const TableKit = [
    TablePlugin.configure({
        node: {
            component: TableElement,
        },
        options: {
            initialTableWidth: 600,
            minColumnWidth: 60,
        },
    }),
    TableRowPlugin.configure({
        node: {
            component: TableRowElement,
        },
    }),
    TableCellPlugin.configure({
        node: {
            component: TableCellElement,
        },
        options: {
            borderStyle: undefined, // 컴포넌트의 스타일을 사용
        },
    }),
    TableCellHeaderPlugin.configure({
        node: {
            component: TableCellHeaderElement,
        },
    }),
];
