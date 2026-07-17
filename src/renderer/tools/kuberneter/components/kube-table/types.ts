import type React from 'react';

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  render?: (row: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
  align?: 'left' | 'center' | 'right';
  /** Initial width in pixels when resizable is enabled */
  initialWidth?: number;
  /** Set false to prevent this specific column from being resized */
  resizable?: boolean;
  /** Set false to prevent this specific column from being sorted. Default: true */
  sortable?: boolean;
  /** Optional custom extractor to get sortable value from row */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sortValue?: (row: T) => any;
}

export interface KubeTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  selectedRowKey?: string | number;
  getRowKey: (row: T, index?: number) => string | number;
  emptyState?: React.ReactNode;
  emptyMessage?: string;
  hideHeaderWhenEmpty?: boolean;
  className?: string;
  /** Enable column resizing by drag. Default: true */
  resizable?: boolean;
  /** Whether to render a top border on the table. Default: true */
  borderTop?: boolean;
  showHeader?: boolean;
  renderRowExpansion?: (row: T) => React.ReactNode;
  expandedRowKeys?: Set<string | number>;
}
