import mongoose from "mongoose";

// Imported for its side effect: registering the model on the default connection, which
// is the connection `syncIndexes()` walks. Keep this in step with the models in `src/`.
import "./order-model";

let isConnected = false;

/**
 * Whether to reconcile MongoDB's indexes with the Mongoose schemas on connect.
 *
 * `syncIndexes()` makes the database match the models: it creates indexes the schemas
 * declare and **drops every index no schema declares** (the `_id` index is always kept).
 *
 * Dropping is the whole point — Mongoose's default `autoIndex` only ever creates, so an
 * index removed from a schema lingers in the database forever as dead write overhead.
 * But dropping is also destructive by design: an index created directly in MongoDB, for
 * a query the schemas don't describe, will be removed. Because of that the sync is
 * opt-out outside production and opt-in inside it:
 *
 * - `MONGO_SYNC_INDEXES=true`  -> always sync, including production
 * - `MONGO_SYNC_INDEXES=false` -> never sync, in any environment
 * - unset                      -> sync everywhere except production
 *
 * Enable it in production only once you are confident no hand-managed indexes exist there.
 */
const shouldSyncIndexes = (): boolean => {
  const flag = process.env.MONGO_SYNC_INDEXES;

  if (flag === "true") return true;
  if (flag === "false") return false;

  return process.env.NODE_ENV !== "production";
};

/**
 * Reconciles the indexes in MongoDB with the schemas registered on the default
 * connection, logging anything that was dropped.
 *
 * Deliberately never throws: a failed sync leaves indexes missing (a performance
 * problem) rather than corrupting data, so it is logged and startup continues.
 */
export const syncOrderIndexes = async (): Promise<void> => {
  try {
    const dropped = await mongoose.connection.syncIndexes();
    const droppedCount = Object.values(dropped).reduce(
      (total, names) => total + names.length,
      0,
    );

    if (droppedCount > 0) {
      console.log(
        `Dropped ${droppedCount} index(es) not declared by the schemas:`,
        dropped,
      );
    } else {
      console.log("MongoDB indexes match the Mongoose schemas");
    }
  } catch (error) {
    console.error("MongoDB index sync failed:", error);
  }
};

export const connectOrderDB = async () => {
  if (isConnected) return;

  if (!process.env.MONGO_URL) {
    throw new Error("MONGO_URL is not defined in env file!");
  }

  try {
    await mongoose.connect(process.env.MONGO_URL);
    isConnected = true;
    console.log("Connected to MongoDB database successfully");

    if (shouldSyncIndexes()) {
      await syncOrderIndexes();
    }
  } catch (error) {
    console.error("MongoDB connection failed:", error);
    throw error;
  }
};
