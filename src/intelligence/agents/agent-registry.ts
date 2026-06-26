import type { BusinessDomain } from "@/intelligence/contracts/types";
import type { AgentRegistry, IntelligenceAgent } from "./agent";

export class DefaultAgentRegistry implements AgentRegistry {
  private readonly agents = new Map<string, IntelligenceAgent>();

  constructor(agents: IntelligenceAgent[] = []) {
    agents.forEach((agent) => this.register(agent));
  }

  register(agent: IntelligenceAgent) {
    this.agents.set(agent.id, agent);
  }

  get(id: string) {
    const agent = this.agents.get(id);
    if (!agent) throw new Error(`Agent "${id}" is not registered.`);
    return agent;
  }

  findByDomain(domain: BusinessDomain) {
    const agent = this.list().find((candidate) => candidate.domain === domain);
    if (!agent) throw new Error(`No agent registered for domain "${domain}".`);
    return agent;
  }

  list() {
    return [...this.agents.values()];
  }
}
