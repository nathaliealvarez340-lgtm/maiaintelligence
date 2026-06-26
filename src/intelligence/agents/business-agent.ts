import type { IntelligenceAgent, PromptTemplates } from "./agent";

interface BusinessAgentConfig {
  id: string;
  name: string;
  role: string;
  domain: IntelligenceAgent["domain"];
  capabilities: string[];
  promptTemplates: PromptTemplates;
}

export class BusinessAgent implements IntelligenceAgent {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly domain: IntelligenceAgent["domain"];
  readonly capabilities: string[];
  readonly promptTemplates: PromptTemplates;
  readonly placeholderOnly = true;

  constructor(config: BusinessAgentConfig) {
    Object.assign(this, config);
    this.id = config.id;
    this.name = config.name;
    this.role = config.role;
    this.domain = config.domain;
    this.capabilities = config.capabilities;
    this.promptTemplates = config.promptTemplates;
  }
}
