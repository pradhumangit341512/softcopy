import { ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import Button from './ Button';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  isLoading = false,
}: PaginationProps) {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  // Show max 5 page buttons
  let visiblePages = pages;
  if (pages.length > 5) {
    if (currentPage <= 3) {
      visiblePages = pages.slice(0, 5);
    } else if (currentPage > pages.length - 3) {
      visiblePages = pages.slice(-5);
    } else {
      visiblePages = pages.slice(currentPage - 3, currentPage + 2);
    }
  }

  return (
    <div className="flex items-center gap-1.5 sm:gap-2 justify-center flex-wrap">
      {/* Previous Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1 || isLoading}
      >
        <ChevronLeft size={16} />
      </Button>

      {/* Page Numbers */}
      {pages.length > 1 && (
        <div className="flex gap-1">
          {visiblePages[0] > 1 && (
            <>
              <button
                onClick={() => onPageChange(1)}
                className="w-8 h-8 sm:w-9 sm:h-9 text-xs sm:text-sm rounded-lg border border-gray-200
                  hover:bg-gray-50 transition-colors flex items-center justify-center"
              >
                1
              </button>
              {visiblePages[0] > 2 && (
                <span className="w-6 h-8 sm:h-9 flex items-center justify-center text-gray-400 text-xs">...</span>
              )}
            </>
          )}

          {visiblePages.map((page) => (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={clsx(
                'w-8 h-8 sm:w-9 sm:h-9 text-xs sm:text-sm rounded-lg transition-colors flex items-center justify-center font-medium',
                page === currentPage
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : 'border border-gray-200 hover:bg-gray-50 text-gray-700'
              )}
              disabled={isLoading}
            >
              {page}
            </button>
          ))}

          {visiblePages[visiblePages.length - 1] < pages.length && (
            <>
              {visiblePages[visiblePages.length - 1] < pages.length - 1 && (
                <span className="w-6 h-8 sm:h-9 flex items-center justify-center text-gray-400 text-xs">...</span>
              )}
              <button
                onClick={() => onPageChange(pages.length)}
                className="w-8 h-8 sm:w-9 sm:h-9 text-xs sm:text-sm rounded-lg border border-gray-200
                  hover:bg-gray-50 transition-colors flex items-center justify-center"
              >
                {pages.length}
              </button>
            </>
          )}
        </div>
      )}

      {/* Next Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages || isLoading}
      >
        <ChevronRight size={16} />
      </Button>
    </div>
  );
}