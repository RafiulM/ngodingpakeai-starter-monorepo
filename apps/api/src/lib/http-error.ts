// Expected HTTP failures. The error handler turns these into the shared JSON
// envelope: { error: { code, message } }.
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}
