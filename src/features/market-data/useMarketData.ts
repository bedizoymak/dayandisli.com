import { useQuery } from "@tanstack/react-query";
import { fetchMarketData } from "./api";

const STALE_TIME_MS = 5 * 60_000;
const REFETCH_INTERVAL_MS = 15 * 60_000;

export const marketDataQueryKeys = {
  all: ["market-data"] as const,
  current: () => [...marketDataQueryKeys.all, "current"] as const,
};

/** React-query keeps the last successful `data` through a background
 * refetch failure by default, so a transient network error never blanks
 * the cards — staleness is then surfaced via `dataUpdatedAt` in the
 * consuming component. */
export function useMarketData() {
  return useQuery({
    queryKey: marketDataQueryKeys.current(),
    queryFn: fetchMarketData,
    staleTime: STALE_TIME_MS,
    refetchInterval: REFETCH_INTERVAL_MS,
    retry: 2,
  });
}
