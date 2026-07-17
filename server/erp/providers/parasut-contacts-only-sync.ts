// ParasutContactsOnlySync — implements ContactsOnlySync by reusing the
// EXISTING syncContacts() sync-engine function (server/parasut/sync-contacts.ts)
// unchanged. Never a full sync — see DAYANDISLI_PHASE_SYSTEM.md §8.15. This
// class does not write the mirror itself; syncContacts (already proven in
// production, see PARASUT_ERP_MODULE_IMPLEMENTATION_REPORT.md) is the only
// writer, satisfying "the mirror can only be updated through the existing
// GET synchronization path."
import { syncContacts } from "../../parasut/sync-contacts.ts";
import type { SyncContext } from "../../parasut/types.ts";
import type { ContactsOnlySync } from "../commands/create-customer-command.ts";

export interface MirrorContactLookup {
  /** True if a contacts row with this parasut_id exists for this company in parasut.contacts. Read-only — the same tenant-scoped pattern as scopedParasutTable in supabase/functions/parasut-api/handlers.ts. */
  existsByParasutId(companyId: string, parasutId: string): Promise<boolean>;
}

export class ParasutContactsOnlySync implements ContactsOnlySync {
  constructor(
    private readonly buildSyncContext: (companyId: string, providerCompanyId: string) => SyncContext,
    private readonly lookup: MirrorContactLookup,
  ) {}

  async syncAndCheck(companyId: string, providerCompanyId: string, providerResourceId: string): Promise<boolean> {
    const context = this.buildSyncContext(companyId, providerCompanyId);
    await syncContacts(context);
    return this.lookup.existsByParasutId(companyId, providerResourceId);
  }
}
