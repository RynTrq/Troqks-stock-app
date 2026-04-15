import {NextResponse} from "next/server";
import {connectToDatabase} from "@/database/mongoose";
import UserModel from "@/database/models/User";
import {jsonError, getRequestBody} from "@/lib/api";
import {getAuthConfigurationError} from "@/lib/config";
import {verifyPassword} from "@/lib/password";
import {createSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS} from "@/lib/session";
import {isValidEmail, isValidPassword, normalizeEmail} from "@/lib/validation";

type SignInRequestBody = SignInFormData;

export const POST = async (request: Request) => {
    const body = await getRequestBody<SignInRequestBody>(request);

    if (!body) return jsonError("Invalid JSON payload.");

    const email = normalizeEmail(body.email ?? "");

    if (!isValidEmail(email)) return jsonError("Enter a valid email address.");
    if (!isValidPassword(body.password ?? "")) return jsonError("Password must be at least 8 characters.");

    const configurationError = getAuthConfigurationError();

    if (configurationError) return jsonError(configurationError, 503);

    let user;

    try {
        await connectToDatabase();
        user = await UserModel.findOne({email}).select("+passwordHash");

        if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
            return jsonError("Invalid email or password.", 401);
        }
    } catch {
        return jsonError("Unable to sign in right now.", 500);
    }

    const sessionUser = {
        id: user._id.toString(),
        email: user.email,
        name: user.fullName,
    };
    const response = NextResponse.json({user: sessionUser});

    response.cookies.set(SESSION_COOKIE_NAME, createSessionToken(sessionUser), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: SESSION_MAX_AGE_SECONDS,
        path: "/",
    });

    return response;
};
