import { syncCollection } from "./sync-base.ts";
import type { SyncContext, SyncResult } from "./types.ts";

export function syncContacts(context: SyncContext): Promise<SyncResult> {
  return syncCollection(context, {
    resourceType: "contacts",
    table: "contacts",
    endpoint: `/v4/${encodeURIComponent(context.parasutCompanyId)}/contacts`,
  });
}
