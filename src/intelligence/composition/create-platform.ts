import { DefaultActionRegistry } from "@/intelligence/actions/action-registry";
import { simulatedActions } from "@/intelligence/actions/simulated-actions";
import { DefaultAgentRegistry } from "@/intelligence/agents/agent-registry";
import { createInitialAgents } from "@/intelligence/agents/initial-agents";
import { BusinessContextEngine } from "@/intelligence/context/context-engine";
import { MaiaIntelligence } from "@/intelligence/core/maia-intelligence";
import { MockMemoryRepository } from "@/intelligence/memory/mock-memory-repository";
import { MockProvider } from "@/intelligence/providers/mock-provider";
import { DeterministicReasoningEngine } from "@/intelligence/reasoning/reasoning-engine";
import { ReasoningPipeline } from "@/intelligence/reasoning/reasoning-pipeline";

export const createMaiaPlatform = () => {
  const provider = new MockProvider();
  const memory = new MockMemoryRepository();
  const context = new BusinessContextEngine(memory);
  const reasoning = new DeterministicReasoningEngine(provider);
  const pipeline = new ReasoningPipeline(provider);
  const agents = new DefaultAgentRegistry(createInitialAgents());
  const actions = new DefaultActionRegistry(simulatedActions);

  return {
    intelligence: new MaiaIntelligence(reasoning, context, agents, actions, pipeline),
    provider,
    memory,
    agents,
    actions,
  };
};

let platform: ReturnType<typeof createMaiaPlatform> | undefined;

export const getMaiaPlatform = () => {
  platform ??= createMaiaPlatform();
  return platform;
};
