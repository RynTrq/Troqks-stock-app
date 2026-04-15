import {createHmac, timingSafeEqual} from "node:crypto";

export const SESSION_COOKIE_NAME = "troqks_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export type SessionUser = {
    id: string;
    email: string;
    name: string;
};

type SessionPayload = SessionUser & {
    exp: number;
};

const getSessionSecret = () => {
    const secret = process.env.AUTH_SECRET;

    if (!secret) {
        if (process.env.NODE_ENV === "production") {
            throw new Error("AUTH_SECRET must be set in production");
        }

        return "troqks-development-session-secret";
    }

    if (secret.length < 32) {
        throw new Error("AUTH_SECRET must be at least 32 characters long");
    }

    return secret;
};

const sign = (payload: string) =>
    createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");

export const createSessionToken = (user: SessionUser, now = Date.now()) => {
    const payload: SessionPayload = {
        ...user,
        exp: now + SESSION_MAX_AGE_SECONDS * 1000,
    };
    const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");

    return `${encodedPayload}.${sign(encodedPayload)}`;
};

export const verifySessionToken = (token: string, now = Date.now()): SessionUser | null => {
    const [encodedPayload, signature] = token.split(".");

    if (!encodedPayload || !signature) return null;

    const expectedSignature = sign(encodedPayload);
    const signatureBuffer = Buffer.from(signature);
    const expectedSignatureBuffer = Buffer.from(expectedSignature);

    if (
        signatureBuffer.length !== expectedSignatureBuffer.length ||
        !timingSafeEqual(signatureBuffer, expectedSignatureBuffer)
    ) {
        return null;
    }

    try {
        const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as SessionPayload;

        if (!payload.id || !payload.email || !payload.name || payload.exp <= now) return null;

        return {
            id: payload.id,
            email: payload.email,
            name: payload.name,
        };
    } catch {
        return null;
    }
};
