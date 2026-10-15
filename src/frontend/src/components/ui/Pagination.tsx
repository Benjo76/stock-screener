import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  itemsPerPage?: number;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  itemsPerPage,
}) => {
  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-3">
      {totalItems !== undefined && itemsPerPage !== undefined ? (
        <p className="text-xs text-muted-foreground">
          Zeige{' '}
          <span className="font-medium text-foreground">
            {Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)}
          </span>{' '}
          bis{' '}
          <span className="font-medium text-foreground">
            {Math.min(currentPage * itemsPerPage, totalItems)}
          </span>{' '}
          von <span className="font-medium text-foreground">{totalItems}</span> Einträgen
        </p>
      ) : (
        <div />
      )}

      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          aria-label="Vorherige Seite"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Zurück</span>
        </Button>

        <span className="text-xs text-muted-foreground px-2">
          Seite <span className="font-semibold text-foreground">{currentPage}</span> von{' '}
          <span className="font-semibold text-foreground">{totalPages}</span>
        </span>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          aria-label="Nächste Seite"
        >
          <span className="hidden sm:inline">Weiter</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
