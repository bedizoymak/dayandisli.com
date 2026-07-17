// NetsisAccountingProvider — skeleton only, not implemented. See
// ACCOUNTING_PROVIDER_ARCHITECTURE.md "Future Providers".
import { UnimplementedAccountingProvider } from "./unimplemented-accounting-provider.ts";

export class NetsisAccountingProvider extends UnimplementedAccountingProvider {
  constructor() {
    super({ id: "netsis", name: "Netsis", version: "0.0.0" });
  }
}
