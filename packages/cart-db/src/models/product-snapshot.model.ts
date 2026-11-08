import mongoose, {
  type HydratedDocument,
  InferSchemaType,
  model,
  Schema,
} from "mongoose";

export const ProductSnapshotSchema = new Schema(
  {
    productId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, default: "Product" },
    price: { type: Number, required: true, default: 0 },
    image: { type: String, default: "" },
    isActive: { type: Boolean, default: true, index: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

export type ProductSnapshotSchemaType = InferSchemaType<
  typeof ProductSnapshotSchema
>;
export type ProductSnapshotDocType = HydratedDocument<ProductSnapshotSchemaType>;

export const ProductSnapshot =
  (mongoose.models
    .ProductSnapshot as mongoose.Model<ProductSnapshotSchemaType>) ||
  model<ProductSnapshotSchemaType>("ProductSnapshot", ProductSnapshotSchema);
