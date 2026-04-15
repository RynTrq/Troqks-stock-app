import mongoose, { InferSchemaType, Model, Schema } from "mongoose";

const strategyExperimentSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    origin: {
      type: String,
      enum: ["prebuilt", "ai-generated"],
      required: true,
    },
    strategyId: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    llmName: {
      type: String,
      default: null,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    prompt: {
      type: String,
      default: null,
    },
    symbolUniverse: {
      type: [String],
      default: [],
    },
    benchmarkSymbol: {
      type: String,
      default: null,
    },
    strategyDefinition: {
      type: Schema.Types.Mixed,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

export type StrategyExperimentDocument = InferSchemaType<typeof strategyExperimentSchema> & {
  _id: mongoose.Types.ObjectId;
};

const StrategyExperimentModel =
  (mongoose.models.StrategyExperiment as Model<StrategyExperimentDocument> | undefined) ??
  mongoose.model<StrategyExperimentDocument>("StrategyExperiment", strategyExperimentSchema);

export default StrategyExperimentModel;
