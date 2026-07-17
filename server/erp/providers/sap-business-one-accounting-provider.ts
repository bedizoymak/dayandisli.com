// SAPBusinessOneAccountingProvider — skeleton only, not implemented. See
// ACCOUNTING_PROVIDER_ARCHITECTURE.md "Future Providers".
import { UnimplementedAccountingProvider } from "./unimplemented-accounting-provider.ts";

export class SAPBusinessOneAccountingProvider extends UnimplementedAccountingProvider {
  constructor() {
    super({ id: "sap_business_one", name: "SAP Business One", version: "0.0.0" });
  }
}
