export class PromptArgumentError extends Error {
  constructor(message) {
    super(message);
    this.name = "PromptArgumentError";
  }
}