export class ObsidianApiError extends Error {
  constructor(message, { status, body } = {}) {
    super(message);
    this.name = "ObsidianApiError";
    this.status = status;
    this.body = body;
  }
}
