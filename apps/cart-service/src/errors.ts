export class CartMergeConflictError extends Error {
  constructor(
    message = "A cart merge operation is currently in-flight for this user",
  ) {
    super(message);
    this.name = "CartMergeConflictError";
  }
}
