import { ChevronLeft, ChevronRight } from 'lucide-react';

function Pagination({ currentPage, totalPages, totalItems, onPageChange }) {
  if (totalPages <= 1) return null;

  const pages = [];
  const showPages = 5;
  let startPage = Math.max(1, currentPage - Math.floor(showPages / 2));
  let endPage = Math.min(totalPages, startPage + showPages - 1);
  
  if (endPage - startPage < showPages - 1) {
    startPage = Math.max(1, endPage - showPages + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t border-[var(--color-border)]">
      {/* Item count */}
      <p className="text-xs text-[var(--color-text-muted)]">
        Showing {Math.min((currentPage - 1) * 20 + 1, totalItems)} - {Math.min(currentPage * 20, totalItems)} of {totalItems}
      </p>

      {/* Page buttons */}
      <div className="flex items-center gap-0.5">
        {/* Prev */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]
                   hover:bg-[var(--color-bg-tertiary)] disabled:opacity-40 disabled:pointer-events-none
                   transition-colors"
          aria-label="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* First page */}
        {startPage > 1 && (
          <>
            <button
              onClick={() => onPageChange(1)}
              className="min-w-[32px] h-8 px-2 text-xs font-medium
                       text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]
                       hover:bg-[var(--color-bg-tertiary)] transition-colors"
            >
              1
            </button>
            {startPage > 2 && (
              <span className="px-1 text-[var(--color-text-muted)] text-xs">...</span>
            )}
          </>
        )}

        {/* Page numbers */}
        {pages.map(page => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`min-w-[32px] h-8 px-2 text-xs font-medium transition-colors
                       ${page === currentPage 
                         ? 'bg-[var(--color-accent)] text-white' 
                         : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]'
                       }`}
          >
            {page}
          </button>
        ))}

        {/* Last page */}
        {endPage < totalPages && (
          <>
            {endPage < totalPages - 1 && (
              <span className="px-1 text-[var(--color-text-muted)] text-xs">...</span>
            )}
            <button
              onClick={() => onPageChange(totalPages)}
              className="min-w-[32px] h-8 px-2 text-xs font-medium
                       text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]
                       hover:bg-[var(--color-bg-tertiary)] transition-colors"
            >
              {totalPages}
            </button>
          </>
        )}

        {/* Next */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]
                   hover:bg-[var(--color-bg-tertiary)] disabled:opacity-40 disabled:pointer-events-none
                   transition-colors"
          aria-label="Next page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default Pagination;
