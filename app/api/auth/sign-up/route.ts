import {NextResponse} from "next/server";
import {connectToDatabase} from "@/database/mongoose";
import UserModel from "@/database/models/User";
import {jsonError, getRequestBody} from "@/lib/api";
import {getAuthConfigurationError} from "@/lib/config";
import {hashPassword} from "@/lib/password";
import {createSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS} from "@/lib/session";
import {
    isValidEmail,
    isValidFullName,
    isValidPassword,
    normalizeEmail
} from "@/lib/validation";

type SignUpRequestBody = SignUpFormData;

export const POST = async (request: Request) => {
    const body = await getRequestBody<SignUpRequestBody>(request);

    if (!body) return jsonError("Invalid JSON payload.");

    const email = normalizeEmail(body.email ?? "");
    const fullName = body.fullName?.trim() ?? "";

    if (!isValidFullName(fullName)) return jsonError("Full name must be at least 2 characters.");
    if (!isValidEmail(email)) return jsonError("Enter a valid email address.");
    if (!isValidPassword(body.password ?? "")) return jsonError("Password must be at least 8 characters.");
    if (!body.country || body.country.length !== 2) return jsonError("Please select a valid country.");
    if (!body.investmentGoals || !body.riskTolerance || !body.preferredIndustry) {
        return jsonError("Investment preferences are required.");
    }

    const configurationError = getAuthConfigurationError();

    if (configurationError) return jsonError(configurationError, 503);

    let user;

    try {
        await connectToDatabase();

        const existingUser = await UserModel.exists({email});

        if (existingUser) return jsonError("An account with this email already exists.", 409);

        user = await UserModel.create({
            fullName,
            email,
            passwordHash: await hashPassword(body.password),
            country: body.country.toUpperCase(),
            investmentGoals: body.investmentGoals,
            riskTolerance: body.riskTolerance,
            preferredIndustry: body.preferredIndustry,
        });
    } catch (error) {
        if (isDuplicateKeyError(error)) {
            return jsonError("An account with this email already exists.", 409);
        }

        return jsonError("Unable to create account right now.", 500);
    }

    const sessionUser = {
        id: user._id.toString(),
        email: user.email,
        name: user.fullName,
    };
    const response = NextResponse.json({user: sessionUser}, {status: 201});

    response.cookies.set(SESSION_COOKIE_NAME, createSessionToken(sessionUser), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: SESSION_MAX_AGE_SECONDS,
        path: "/",
    });

    return response;
};

const isDuplicateKeyError = (error: unknown) =>
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000;
