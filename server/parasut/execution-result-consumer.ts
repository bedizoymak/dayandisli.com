import type { ExecutionResultComposition } from "./execution-result-composition.ts";
import type { ExecutionResultEnvelope } from "./execution-result-envelope.ts";

export type ExecutionEnvelopeConsumer = (
  envelope: ExecutionResultEnvelope,
) => void | Promise<void>;

const NOOP_CONSUMER: ExecutionEnvelopeConsumer = () => undefined;

async function deliverEnvelope(
  envelope: ExecutionResultEnvelope,
  consumer: ExecutionEnvelopeConsumer,
): Promise<void> {
  try {
    await consumer(envelope);
  } catch {
    // Envelope delivery must never alter execution outcomes.
  }
}

export async function consumeExecutionResult<Report>(
  composition: ExecutionResultComposition<Report>,
  consumer: ExecutionEnvelopeConsumer = NOOP_CONSUMER,
): Promise<Report[]> {
  await deliverEnvelope(composition.envelope, consumer);

  if (composition.outcome === "failed") {
    throw composition.originalError;
  }

  return [...composition.reports];
}
