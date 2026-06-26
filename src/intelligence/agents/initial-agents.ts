import { BusinessAgent } from "./business-agent";

export const createInitialAgents = () => [
  new BusinessAgent(
    {
      id: "strategy-agent",
      name: "Strategy Agent",
      role: "Strategic decision and market-position advisor",
      domain: "strategy",
      capabilities: ["strategic analysis", "market framing", "goal alignment"],
      promptTemplates: {
        analysis: "Analyze the strategic implications and decision tradeoffs.",
        recommendation: "Recommend a focused strategic direction.",
      },
    },
  ),
  new BusinessAgent(
    {
      id: "finance-agent",
      name: "Finance Agent",
      role: "Financial performance and resource-allocation advisor",
      domain: "finance",
      capabilities: ["financial analysis", "resource allocation", "risk assessment"],
      promptTemplates: {
        analysis: "Analyze financial impact, assumptions, and exposure.",
        recommendation: "Recommend financially responsible next actions.",
      },
    },
  ),
  new BusinessAgent(
    {
      id: "operations-agent",
      name: "Operations Agent",
      role: "Operational performance and execution advisor",
      domain: "operations",
      capabilities: ["process analysis", "capacity planning", "execution design"],
      promptTemplates: {
        analysis: "Analyze operational constraints, dependencies, and execution risk.",
        recommendation: "Recommend pragmatic operational next actions.",
      },
    },
  ),
];
