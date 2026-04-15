export const getAuthConfigurationError = () => {
    if (!process.env.MONGODB_URI) {
        return "Authentication is not configured. Set MONGODB_URI before signing in.";
    }

    if (process.env.NODE_ENV === "production" && !process.env.AUTH_SECRET) {
        return "Authentication is not configured. Set AUTH_SECRET before signing in.";
    }

    if (process.env.AUTH_SECRET && process.env.AUTH_SECRET.length < 32) {
        return "AUTH_SECRET must be at least 32 characters long.";
    }

    return null;
};
