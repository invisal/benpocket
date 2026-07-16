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
}

export interface KubeTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  selectedRowKey?: string | number;
  getRowKey: (row: T) => string | number;
  emptyState?: React.ReactNode;
  emptyMessage?: string;
  hideHeaderWhenEmpty?: boolean;
  className?: string;
  variant?: 'standard' | 'modern';
  /** Enable column resizing by drag. Default: true */
  resizable?: boolean;
  /** Fixed row height for virtualization. Optional */
  rowHeight?: number;
}
