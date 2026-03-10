export class ToolArgumentError extends Error {
  constructor(message) {
    super(message);
    this.name = "ToolArgumentError";
  }
}
