export { Order, type OrderSchemaType, OrderStatus } from "./order-model";
export {
  OutboxEvent,
  type OutboxEventSchemaType,
  type OutboxEventDocument,
  OutboxStatus,
  type OutboxStatusType,
  createOutboxEvent,
  claimPendingOutboxEvents,
  markOutboxPublished,
  markOutboxFailed,
} from "./outbox-model";
export {
  connectOrderDB,
  syncOrderIndexes,
  ensureOrderCollectionSharded,
  type OrderDBConnectionOptions,
} from "./connection";
export { default as mongoose } from "mongoose";
