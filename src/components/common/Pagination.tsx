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
  pageSize = 8,
  className = '',
}) => {
  // Se houver 1 ou menos páginas (até 8 registros), a paginação não deve ser exibida
  if (totalPages <= 1) {
    return null;
  }

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem =
    totalItems !== undefined ? Math.min(currentPage * pageSize, totalItems) : undefined;

  return (
    <div className={`pagination-container ${className}`}>
      {totalItems !== undefined ? (
        <span className="pagination-info">
          Exibindo {startItem}–{endItem} de {totalItems}
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

        {pages.map((page) => (
          <button
            key={page}
            type="button"
            className={`pagination-btn ${page === currentPage ? 'active' : ''}`}
            onClick={() => onPageChange(page)}
            aria-current={page === currentPage ? 'page' : undefined}
          >
            {page}
          </button>
        ))}

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
