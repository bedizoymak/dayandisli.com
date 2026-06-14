import type { ExecutionEnvelopeConsumer } from "./execution-result-consumer.ts";
import type { ExecutionResultEnvelope } from "./execution-result-envelope.ts";

type Environment = Record<string, string | undefined>;
type DiagnosticWriter = (line: string) => void | Promise<void>;

export interface ExecutionEnvelopeDiagnosticOptions {
  env?: Environment;
  diagnosticWriter?: DiagnosticWriter;
}

export function isExecutionEnvelopeDiagnosticEnabled(
  env: Environment,
): boolean {
  return env.PARASUT_EXECUTION_ENVELOPE_DIAGNOSTICS === "1";
}

export function createExecutionEnvelopeDiagnostic(
  options: ExecutionEnvelopeDiagnosticOptions = {},
): ExecutionEnvelopeConsumer {
  const enabled = isExecutionEnvelopeDiagnosticEnabled(options.env ?? {});
  const diagnosticWriter = options.diagnosticWriter ?? (() => undefined);

  return async (envelope: ExecutionResultEnvelope): Promise<void> => {
    if (!enabled) return;

    try {
      await diagnosticWriter(`${JSON.stringify(envelope)}\n`);
    } catch {
      // Diagnostic delivery must never alter execution outcomes.
    }
  };
}
