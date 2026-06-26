import type { AIProvider } from "./provider";

abstract class UnconfiguredProvider implements AIProvider {
  abstract readonly id: string;

  protected unavailable(): never {
    throw new Error(`${this.id} provider is not configured.`);
  }

  async generateResponse() {
    return this.unavailable();
  }

  async classifyIntent() {
    return this.unavailable();
  }

  async summarize() {
    return this.unavailable();
  }

  async extractActions() {
    return this.unavailable();
  }
}

export class AnthropicProvider extends UnconfiguredProvider {
  readonly id = "anthropic";
}
