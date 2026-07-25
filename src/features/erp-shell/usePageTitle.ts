import { useEffect } from "react";

/**
 * Route-level page title ownership. Each dedicated /apps page composition
 * root calls this with its own title so page identity is declared at the
 * route/page layer rather than left implicit in shared feature components.
 */
export function usePageTitle(title: string) {
  useEffect(() => {
    const previous = document.title;
    document.title = `${title} · Dayan Dişli ERP`;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
