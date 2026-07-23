import type { SalesActivity, SalesOrder, SalesQuote } from "./salesTypes";

export const salesQuotes: SalesQuote[] = [];
export const salesOrders: SalesOrder[] = [];
export const salesActivities: SalesActivity[] = [];

export const salesSubmenu = [
  { id: "quotes", label: "Teklifler", route: "/apps/sales/quotes" },
  { id: "orders", label: "Siparişler", route: "/apps/sales/orders" },
  {
    id: "activities",
    label: "Satış Faaliyetleri",
    route: "/apps/sales/activities",
  },
] as const;
