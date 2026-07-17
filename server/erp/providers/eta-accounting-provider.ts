// ETAAccountingProvider — skeleton only, not implemented. See
// ACCOUNTING_PROVIDER_ARCHITECTURE.md "Future Providers".
import { UnimplementedAccountingProvider } from "./unimplemented-accounting-provider.ts";

export class ETAAccountingProvider extends UnimplementedAccountingProvider {
  constructor() {
    super({ id: "eta", name: "ETA", version: "0.0.0" });
  }
}
