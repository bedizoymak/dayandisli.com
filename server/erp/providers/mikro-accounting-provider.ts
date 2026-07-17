// MikroAccountingProvider — skeleton only, not implemented. See
// ACCOUNTING_PROVIDER_ARCHITECTURE.md "Future Providers".
import { UnimplementedAccountingProvider } from "./unimplemented-accounting-provider.ts";

export class MikroAccountingProvider extends UnimplementedAccountingProvider {
  constructor() {
    super({ id: "mikro", name: "Mikro", version: "0.0.0" });
  }
}
