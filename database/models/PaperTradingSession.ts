import mongoose, { InferSchemaType, Model, Schema } from "mongoose";

const paperTradingSessionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    symbol: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    benchmarkSymbol: {
      type: String,
      default: null,
    },
    strategyId: {
      type: String,
      required: true,
    },
    strategyName: {
      type: String,
      required: true,
    },
    strategyDefinition: {
      type: Schema.Types.Mixed,
      required: true,
    },
    parameters: {
      type: Schema.Types.Mixed,
      required: true,
      default: {},
    },
    initialCapital: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "paused", "closed"],
      default: "active",
    },
    lookbackBars: {
      type: Number,
      default: 180,
    },
    snapshot: {
      type: Schema.Types.Mixed,
      default: null,
    },
    tradeLog: {
      type: [Schema.Types.Mixed],
      default: [],
    },
    equityCurve: {
      type: [Schema.Types.Mixed],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

export type PaperTradingSessionDocument = InferSchemaType<typeof paperTradingSessionSchema> & {
  _id: mongoose.Types.ObjectId;
};

const PaperTradingSessionModel =
  (mongoose.models.PaperTradingSession as Model<PaperTradingSessionDocument> | undefined) ??
  mongoose.model<PaperTradingSessionDocument>("PaperTradingSession", paperTradingSessionSchema);

export default PaperTradingSessionModel;
