import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { ADMIN_PAGE_SIZE, getRangeLabel, getTotalPages } from "@/lib/adminPagination";

interface AdminPaginationProps {
  page: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  itemLabel?: string;
  disabled?: boolean;
}

/** Controle padrão de paginação do Painel Master: "1–50 de 500". */
export const AdminPagination = ({
  page,
  totalItems,
  onPageChange,
  pageSize = ADMIN_PAGE_SIZE,
  itemLabel = "registros",
  disabled = false,
}: AdminPaginationProps) => {
  const totalPages = getTotalPages(totalItems, pageSize);
  const { start, end } = getRangeLabel(page, totalItems, pageSize);

  const pages = useMemo(() => {
    const list = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
      (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1,
    );
    const out: (number | "gap")[] = [];
    list.forEach((p, i) => {
      if (i > 0 && p - list[i - 1] > 1) out.push("gap");
      out.push(p);
    });
    return out;
  }, [totalPages, page]);

  const go = (p: number) => {
    if (disabled) return;
    const next = Math.min(Math.max(1, p), totalPages);
    if (next !== page) onPageChange(next);
  };

  return (
    <nav
      aria-label="Paginação"
      className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4"
    >
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {start}–{end} de {totalItems} {itemLabel}
      </p>
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => go(1)} disabled={disabled || page <= 1} aria-label="Primeira página">
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => go(page - 1)} disabled={disabled || page <= 1} aria-label="Página anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {pages.map((p, i) =>
            p === "gap" ? (
              <span key={`gap-${i}`} className="px-1 text-muted-foreground">…</span>
            ) : (
              <Button
                key={p}
                variant={p === page ? "default" : "outline"}
                size="sm"
                className="h-8 min-w-8 px-2"
                onClick={() => go(p)}
                disabled={disabled}
                aria-current={p === page ? "page" : undefined}
                aria-label={`Página ${p}`}
              >
                {p}
              </Button>
            ),
          )}
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => go(page + 1)} disabled={disabled || page >= totalPages} aria-label="Próxima página">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => go(totalPages)} disabled={disabled || page >= totalPages} aria-label="Última página">
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </nav>
  );
};

/**
 * Paginação sobre uma lista já filtrada (total = todos os resultados filtrados).
 * Volta para a página 1 quando `resetKey` muda e corrige página fora do intervalo.
 */
export function useClientPagination<T>(items: T[] | undefined, resetKey: unknown, pageSize = ADMIN_PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const list = items ?? [];
  const totalItems = list.length;
  const totalPages = getTotalPages(totalItems, pageSize);
  const key = JSON.stringify(resetKey);

  useEffect(() => { setPage(1); }, [key]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  const safePage = Math.min(page, totalPages);
  const pageItems = useMemo(
    () => list.slice((safePage - 1) * pageSize, safePage * pageSize),
    [list, safePage, pageSize],
  );
  return { page: safePage, setPage, totalItems, pageItems };
}
