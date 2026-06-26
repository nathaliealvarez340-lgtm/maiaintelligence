import type { BusinessDomain } from "@/intelligence/contracts/types";
import type { IntelligenceAction } from "./action";

const allDomains: BusinessDomain[] = ["strategy", "finance", "operations"];

const action = (id: string, name: string, description: string): IntelligenceAction => ({
  id,
  name,
  description,
  supportedDomains: allDomains,
  async execute(suggestion, context) {
    return {
      actionId: id,
      status: "simulated",
      message: `${name} simulated for ${context.productContext}: ${suggestion.title}`,
    };
  },
});

export const simulatedActions = [
  action("create-task", "Create Task", "Create an accountable work item."),
  action("generate-report", "Generate Report", "Generate a structured business report."),
  action("detect-risks", "Detect Risks", "Evaluate current context for material risks."),
  action("summarize-business-status", "Summarize Business Status", "Summarize business health."),
  action("suggest-next-actions", "Suggest Next Actions", "Turn analysis into prioritized actions."),
];
