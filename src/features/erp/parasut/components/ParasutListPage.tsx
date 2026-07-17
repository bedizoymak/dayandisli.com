import { ReactNode, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/erp/PageHeader";
import { DataTable, type DataTableColumn } from "@/components/erp/DataTable";
import { useParasutList } from "../api/queries";
import { formatCount } from "../utils/format";
import { ParasutEmptyState, ParasutErrorState, ParasutLoadingState } from "./ParasutStateViews";
import type { ListQueryParams, ParasutListResource } from "../types";

export function ParasutListPage<TRow>({
  title,
  description,
  resource,
  columns,
  searchPlaceholder = "Ara...",
  emptyDescription,
  filters,
  onRowClick,
  extraFilters,
  rowKey,
  actions,
}: {
  title: string;
  description: string;
  resource: ParasutListResource;
  columns: DataTableColumn<TRow>[];
  searchPlaceholder?: string;
  emptyDescription: string;
  filters?: ListQueryParams["filters"];
  onRowClick?: (row: TRow) => void;
  extraFilters?: ReactNode;
  rowKey: (row: TRow, index: number) => string;
  actions?: ReactNode;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(searchParams.get("q") ?? "");
  const page = Number(searchParams.get("page") ?? "1") || 1;
  const pageSize = Number(searchParams.get("size") ?? "25") || 25;

  useEffect(() => {
    const handle = setTimeout(() => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        if (searchInput) next.set("q", searchInput);
        else next.delete("q");
        next.set("page", "1");
        return next;
      });
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const search = searchParams.get("q") ?? "";
  const queryParams = useMemo<ListQueryParams>(() => ({ page, pageSize, search, filters }), [page, pageSize, search, filters]);
  const { data, isLoading, isError, error, refetch, isFetching } = useParasutList<TRow>(resource, queryParams);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  const setPage = (nextPage: number) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("page", String(nextPage));
      return next;
    });
  };

  const clearFilters = () => {
    setSearchInput("");
    setSearchParams(new URLSearchParams());
  };

  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} actions={actions} />

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <Input
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label="Ara"
          className="md:max-w-sm"
        />
        {extraFilters}
        <Button variant="outline" size="sm" onClick={clearFilters} className="md:ml-auto">
          Filtreleri Temizle
        </Button>
      </div>

      {isLoading ? (
        <ParasutLoadingState />
      ) : isError ? (
        <ParasutErrorState message={error instanceof Error ? error.message : "Beklenmeyen bir hata oluştu."} onRetry={() => void refetch()} />
      ) : !data || data.rows.length === 0 ? (
        <ParasutEmptyState description={emptyDescription} />
      ) : (
        <div className="space-y-3">
          <DataTable
            columns={
              onRowClick
                ? columns.map((column, index) =>
                    index === 0
                      ? {
                          ...column,
                          render: (row: TRow) => (
                            <button
                              type="button"
                              onClick={() => onRowClick(row)}
                              className="text-left font-medium text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background rounded"
                            >
                              {column.render(row)}
                            </button>
                          ),
                        }
                      : column,
                  )
                : columns
            }
            data={data.rows}
            rowKey={rowKey}
          />

          <div className="flex flex-col items-center justify-between gap-3 text-sm text-muted-foreground md:flex-row">
            <span>
              Toplam {formatCount(data.total)} kayıt · Sayfa {data.page} / {totalPages}
              {isFetching ? " · güncelleniyor..." : ""}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="mr-1 h-4 w-4" /> Önceki
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                Sonraki <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
