const PRODUCTION_PROJECT_REF = "meauutjsnnggzcigyvfp";
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1"]);

export interface LocalOnlyEnvironment {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  RUN_LOCAL_DB_TESTS?: string;
}

export interface LocalEnvironment {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export interface SyntheticPayload {
  marker: "dayan-local-integration";
  runId: string;
  resourceType: string;
  externalId: string;
  attributes: {
    synthetic: true;
    sequence: number;
  };
}

function parseSupabaseUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
}

export function isLocalSupabaseUrl(value: string): boolean {
  const normalized = value.trim();
  if (!normalized || normalized.toLowerCase().includes(PRODUCTION_PROJECT_REF)) {
    return false;
  }

  const url = parseSupabaseUrl(normalized);
  return url !== null && LOCAL_HOSTNAMES.has(url.hostname.toLowerCase());
}

export function assertLocalOnlyEnvironment(
  environment: LocalOnlyEnvironment,
): LocalEnvironment {
  const supabaseUrl = environment.SUPABASE_URL?.trim() ?? "";
  const supabaseAnonKey = environment.SUPABASE_ANON_KEY?.trim() ?? "";

  if (environment.RUN_LOCAL_DB_TESTS !== "1") {
    throw new Error("Local database tests require RUN_LOCAL_DB_TESTS=1");
  }
  if (!supabaseUrl) {
    throw new Error("Local database tests require SUPABASE_URL");
  }
  if (!isLocalSupabaseUrl(supabaseUrl)) {
    throw new Error("SUPABASE_URL must target localhost or 127.0.0.1");
  }
  if (!supabaseAnonKey) {
    throw new Error("Local database tests require SUPABASE_ANON_KEY");
  }

  return { supabaseUrl, supabaseAnonKey };
}

export function verifyDatabaseCleanup(
  remainingRows: Readonly<Record<string, number>>,
): void {
  const incomplete = Object.entries(remainingRows).filter(
    ([, count]) => !Number.isFinite(count) || count < 0 || count !== 0,
  );

  if (incomplete.length > 0) {
    const summary = incomplete
      .map(([scope, count]) => `${scope}=${String(count)}`)
      .join(", ");
    throw new Error(`Synthetic database cleanup is incomplete: ${summary}`);
  }
}

export function createSyntheticPayload(
  sequence: number,
  resourceType = "contacts",
): SyntheticPayload {
  if (!Number.isSafeInteger(sequence) || sequence < 1) {
    throw new Error("Synthetic payload sequence must be a positive integer");
  }

  const suffix = sequence.toString().padStart(4, "0");
  return {
    marker: "dayan-local-integration",
    runId: `local-run-${suffix}`,
    resourceType,
    externalId: `synthetic-${resourceType}-${suffix}`,
    attributes: {
      synthetic: true,
      sequence,
    },
  };
}

export { PRODUCTION_PROJECT_REF };

