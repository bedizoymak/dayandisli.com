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

export type Dispatch = {
  no: string;
  party: string;
  type: string;
  date: string;
  quantity: string;
  status: string;
};

export type StockMovement = {
  product: string;
  type: string;
  party: string;
  date: string;
  quantity: string;
};

export type Supplier = {
  name: string;
  short: string;
  taxNo: string;
  phone: string;
  email: string;
  city: string;
  contact: string;
};

export type Order = {
  no: string;
  customer: string;
  customerId: string;
  orderDate: string;
  delivery: string;
  status: string;
  total: string;
  invoice?: string;
};

export const parties: PartyRef[] = [];
export const products: ProductRef[] = [];
export const dispatches: Dispatch[] = [];
export const stockMovements: StockMovement[] = [];
export const suppliers: Supplier[] = [];
export const orders: Order[] = [];
