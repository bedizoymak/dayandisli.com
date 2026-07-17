// Explicit CLI entry point — kept separate from run-parasut-sync-production.ts
// so importing that module (e.g. from its test file) never triggers main().
import { main } from "./run-parasut-sync-production.ts";

main().catch((error) => {
  console.log(`[sync] FAILED: ${(error as Error).message}`);
  process.exit(1);
});
