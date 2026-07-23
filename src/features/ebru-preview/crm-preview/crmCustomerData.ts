import type { CollectionMovement, CrmCustomer, CustomerInvoiceRef } from "./crmCustomerTypes";

export const crmCustomers: CrmCustomer[] = [];
export const customerFormDefaults = {
  companyName: "",
  personType: "Firma",
  taxNo: "",
  contact: "",
  taxOffice: "",
  phone: "",
  email: "",
  city: "",
  district: "",
  website: "",
  address: "",
  status: "Aktif",
  accountType: "Resmi Hesap",
  riskLimit: "",
  dueDays: "",
  currency: "TRY",
  tags: "",
  notes: "",
};
export const officialCollectionMovements: CollectionMovement[] = [];
export const unofficialCollectionMovements: CollectionMovement[] = [];
export const officialAccountSummary = { planned: "₺0", collected: "₺0", balance: "₺0", overdue: "₺0", upcoming: "₺0", shares: [0, 0, 100] };
export const unofficialAccountSummary = { planned: "₺0", collected: "₺0", balance: "₺0", overdue: "₺0", upcoming: "₺0", shares: [0, 0, 100] };
export const customerInvoiceRefs: CustomerInvoiceRef[] = [];
export const crmSubmenu = [{ id: "customers", label: "Müşteriler", route: "/apps/crm/customers" }];
