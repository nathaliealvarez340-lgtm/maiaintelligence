export const FirstUserBootstrapOutcomes = {
  succeeded: "BOOTSTRAP_SUCCEEDED",
  notEligible: "BOOTSTRAP_NOT_ELIGIBLE",
} as const;

export type FirstUserBootstrapOutcome =
  (typeof FirstUserBootstrapOutcomes)[keyof typeof FirstUserBootstrapOutcomes];
