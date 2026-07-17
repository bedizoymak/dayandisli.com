// LucaAccountingProvider — skeleton only, not implemented. See
// ACCOUNTING_PROVIDER_ARCHITECTURE.md "Future Providers".
import { UnimplementedAccountingProvider } from "./unimplemented-accounting-provider.ts";

export class LucaAccountingProvider extends UnimplementedAccountingProvider {
  constructor() {
    super({ id: "luca", name: "Luca", version: "0.0.0" });
  }
}
