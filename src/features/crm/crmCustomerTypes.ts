export type CrmCustomer = {
  id: string;
  name: string;
  type: "Tüzel Kişi" | "Gerçek Kişi";
  taxNo: string;
  phone: string;
  whatsapp?: string;
  email: string;
  projects: string[];
  planned: string;
  collected: string;
  balance: string;
  contact: string;
  address: string;
};
export type CollectionMovement = {
  date: string;
  title: string;
  planned: string;
  paid: string;
  status: "Planlanan" | "Gecikmiş" | "Gerçekleşti";
  project: string;
};
export type CustomerInvoiceRef = {
  type: string;
  no: string;
  date: string;
  due: string;
  amount: string;
  status: string;
};
