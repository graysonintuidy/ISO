'use client';

import { useState, useMemo, useCallback } from 'react';
import { ArrowUp, ArrowDown, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './DataTable.module.css';

export default function DataTable({
  columns = [],
  data = [],
  emptyMessage = 'No data available',
  onRowClick,
  pageSize = 10,
}) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);

  const handleSort = useCallback((key) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  }, [sortKey]);

  const sortedData = useMemo(() => {
    if (!sortKey) return data;

    return [...data].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      let comparison = 0;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      } else {
        comparison = String(aVal).localeCompare(String(bVal));
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [data, sortKey, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const startIdx = (currentPage - 1) * pageSize;
  const paginatedData = sortedData.slice(startIdx, startIdx + pageSize);

  const getSortIcon = (columnKey) => {
    if (sortKey !== columnKey) {
      return <ChevronsUpDown size={14} />;
    }
    return sortDirection === 'asc'
      ? <ArrowUp size={14} />
      : <ArrowDown size={14} />;
  };

  const goToPage = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  if (!data.length) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.empty}>{emptyMessage}</div>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={col.sortable ? styles.sortable : undefined}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  <span className={styles.headerContent}>
                    {col.label}
                    {col.sortable && (
                      <span
                        className={`${styles.sortIcon} ${
                          sortKey === col.key ? styles.sortIconActive : ''
                        }`}
                      >
                        {getSortIcon(col.key)}
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((row, rowIdx) => (
              <tr
                key={row.id ?? startIdx + rowIdx}
                className={onRowClick ? styles.clickableRow : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((col) => (
                  <td key={col.key}>
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <span className={styles.pageInfo}>
            Showing {startIdx + 1}–{Math.min(startIdx + pageSize, sortedData.length)} of{' '}
            {sortedData.length}
          </span>
          <div className={styles.pageControls}>
            <button
              className={styles.pageButton}
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              aria-label="Previous page"
            >
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((page) => {
                if (totalPages <= 5) return true;
                if (page === 1 || page === totalPages) return true;
                return Math.abs(page - currentPage) <= 1;
              })
              .map((page, idx, arr) => {
                const elements = [];
                if (idx > 0 && page - arr[idx - 1] > 1) {
                  elements.push(
                    <span key={`ellipsis-${page}`} className={styles.pageButton} style={{ border: 'none', cursor: 'default' }}>
                      …
                    </span>
                  );
                }
                elements.push(
                  <button
                    key={page}
                    className={`${styles.pageButton} ${
                      page === currentPage ? styles.pageButtonActive : ''
                    }`}
                    onClick={() => goToPage(page)}
                    aria-label={`Page ${page}`}
                    aria-current={page === currentPage ? 'page' : undefined}
                  >
                    {page}
                  </button>
                );
                return elements;
              })}
            <button
              className={styles.pageButton}
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              aria-label="Next page"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
