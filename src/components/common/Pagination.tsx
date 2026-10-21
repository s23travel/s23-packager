import React from 'react';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  pageSize?: number;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  pageSize = 10,
  className = '',
}) => {
  // Se houver 1 ou menos páginas, a paginação não precisa ser exibida
  if (totalPages <= 1) {
    return null;
  }

  const getPageNumbers = (): (number | string)[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages];
    }
    if (currentPage >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
  };

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem =
    totalItems !== undefined ? Math.min(currentPage * pageSize, totalItems) : undefined;

  return (
    <div className={`pagination-container ${className}`}>
      {totalItems !== undefined ? (
        <span className="pagination-info">
          Exibindo <strong>{startItem}–{endItem}</strong> de <strong>{totalItems}</strong>
        </span>
      ) : (
        <span />
      )}
      <div className="pagination-pages">
        <button
          type="button"
          className="pagination-btn"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          aria-label="Página anterior"
        >
          &larr; Anterior
        </button>

        {getPageNumbers().map((item, index) =>
          typeof item === 'number' ? (
            <button
              key={item}
              type="button"
              className={`pagination-btn ${item === currentPage ? 'active' : ''}`}
              onClick={() => onPageChange(item)}
              aria-current={item === currentPage ? 'page' : undefined}
            >
              {item}
            </button>
          ) : (
            <span key={`ellipsis-${index}`} className="pagination-ellipsis">
              &hellip;
            </span>
          )
        )}

        <button
          type="button"
          className="pagination-btn"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          aria-label="Próxima página"
        >
          Próximo &rarr;
        </button>
      </div>
    </div>
  );
};
