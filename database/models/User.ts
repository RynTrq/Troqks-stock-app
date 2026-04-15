import mongoose, {Schema, type InferSchemaType, type Model} from "mongoose";

const userSchema = new Schema(
    {
        fullName: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 120,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            maxlength: 254,
        },
        passwordHash: {
            type: String,
            required: true,
        },
        country: {
            type: String,
            required: true,
            uppercase: true,
            minlength: 2,
            maxlength: 2,
        },
        investmentGoals: {
            type: String,
            required: true,
        },
        riskTolerance: {
            type: String,
            required: true,
        },
        preferredIndustry: {
            type: String,
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

export type UserDocument = InferSchemaType<typeof userSchema> & {
    _id: mongoose.Types.ObjectId;
};

const UserModel =
    (mongoose.models.User as Model<UserDocument> | undefined) ??
    mongoose.model<UserDocument>("User", userSchema);

export default UserModel;
