// LogoAccountingProvider — skeleton only, not implemented. See
// ACCOUNTING_PROVIDER_ARCHITECTURE.md "Future Providers".
import { UnimplementedAccountingProvider } from "./unimplemented-accounting-provider.ts";

export class LogoAccountingProvider extends UnimplementedAccountingProvider {
  constructor() {
    super({ id: "logo", name: "Logo", version: "0.0.0" });
  }
}
