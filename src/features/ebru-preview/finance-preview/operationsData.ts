export type PartyRef = {
  id: string;
  name: string;
  type: "customer" | "supplier";
};
export type ProductRef = {
  id: string;
  name: string;
  code: string;
  stock: number;
  purchase: number;
  sale: number;
};
export type DispatchRef = {
  no: string;
  party: string;
  type: string;
  date: string;
  quantity: string;
  status: string;
};
export type StockMovementRef = {
  product: string;
  type: string;
  party: string;
  date: string;
  quantity: string;
};
export type SupplierRef = {
  name: string;
  short: string;
  taxNo: string;
  phone: string;
  email: string;
  city: string;
  contact: string;
};
export type OrderRef = {
  no: string;
  customer: string;
  orderDate: string;
  delivery: string;
  status: string;
  total: string;
  invoice: string;
};

// Production list routes use CanonicalParasutPages and live repositories.
// The blank choices keep the approved form structure usable where a proven
// live selector/write repository does not yet exist, without shipping demo
// companies, products, balances, or transactions in the production bundle.
export const parties: PartyRef[] = [
  { id: "", name: "Senkronize kayıt seçilmedi", type: "customer" },
  { id: "", name: "Senkronize kayıt seçilmedi", type: "supplier" },
];
export const products: ProductRef[] = [
  { id: "", name: "Senkronize ürün seçilmedi", code: "", stock: 0, purchase: 0, sale: 0 },
];
export const dispatches: DispatchRef[] = [];
export const stockMovements: StockMovementRef[] = [];
export const suppliers: SupplierRef[] = [];
export const orders: OrderRef[] = [];
