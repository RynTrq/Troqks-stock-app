import mongoose, { InferSchemaType, Model, Schema } from "mongoose";

const backtestRunSchema = new Schema(
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
    startDate: {
      type: String,
      required: true,
    },
    endDate: {
      type: String,
      required: true,
    },
    initialCapital: {
      type: Number,
      required: true,
    },
    metrics: {
      type: Schema.Types.Mixed,
      required: true,
    },
    equityCurve: {
      type: [Schema.Types.Mixed],
      required: true,
      default: [],
    },
    trades: {
      type: [Schema.Types.Mixed],
      required: true,
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

export type BacktestRunDocument = InferSchemaType<typeof backtestRunSchema> & {
  _id: mongoose.Types.ObjectId;
};

const BacktestRunModel =
  (mongoose.models.BacktestRun as Model<BacktestRunDocument> | undefined) ??
  mongoose.model<BacktestRunDocument>("BacktestRun", backtestRunSchema);

export default BacktestRunModel;

