import { FirstUserBootstrapOutcomes } from "./bootstrap-outcome";

export interface SerializedFirstUserBootstrapOperations<TSubject, TResult> {
  acquireSerialization(): Promise<() => void | Promise<void>>;
  resolveSubject(): Promise<TSubject>;
  resolveExistingOwner(subject: TSubject): Promise<TResult | null>;
  hasEstablishedState(subject: TSubject): Promise<boolean>;
  onBootstrapStarted(subject: TSubject): void;
  createInitialOwner(subject: TSubject): Promise<TResult>;
}

export type SerializedFirstUserBootstrapResult<TResult> =
  | {
      outcome: typeof FirstUserBootstrapOutcomes.succeeded;
      value: TResult;
      performed: boolean;
    }
  | {
      outcome: typeof FirstUserBootstrapOutcomes.notEligible;
      performed: false;
    };

export const runSerializedFirstUserBootstrap = async <TSubject, TResult>(
  operations: SerializedFirstUserBootstrapOperations<TSubject, TResult>,
): Promise<SerializedFirstUserBootstrapResult<TResult>> => {
  const releaseSerialization = await operations.acquireSerialization();

  try {
    const subject = await operations.resolveSubject();
    const existingOwner = await operations.resolveExistingOwner(subject);
    if (existingOwner !== null) {
      return {
        outcome: FirstUserBootstrapOutcomes.succeeded,
        value: existingOwner,
        performed: false,
      };
    }

    if (await operations.hasEstablishedState(subject)) {
      return {
        outcome: FirstUserBootstrapOutcomes.notEligible,
        performed: false,
      };
    }

    operations.onBootstrapStarted(subject);

    return {
      outcome: FirstUserBootstrapOutcomes.succeeded,
      value: await operations.createInitialOwner(subject),
      performed: true,
    };
  } finally {
    await releaseSerialization();
  }
};
