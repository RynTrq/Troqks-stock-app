import {describe, expect, it, vi} from "vitest";
import {createSessionToken, SESSION_MAX_AGE_SECONDS, verifySessionToken} from "@/lib/session";

describe("session helpers", () => {
    it("creates and verifies signed session tokens", () => {
        vi.stubEnv("AUTH_SECRET", "0123456789abcdef0123456789abcdef");

        const user = {id: "user-id", email: "ada@example.com", name: "Ada Lovelace"};
        const token = createSessionToken(user, 1_000);

        expect(verifySessionToken(token, 1_000)).toEqual(user);

        vi.unstubAllEnvs();
    });

    it("rejects tampered and expired tokens", () => {
        vi.stubEnv("AUTH_SECRET", "0123456789abcdef0123456789abcdef");

        const user = {id: "user-id", email: "ada@example.com", name: "Ada Lovelace"};
        const token = createSessionToken(user, 1_000);
        const [payload] = token.split(".");
        const tamperedToken = `${payload}.bad-signature`;

        expect(verifySessionToken(tamperedToken, 1_000)).toBeNull();
        expect(verifySessionToken(token, 1_000 + SESSION_MAX_AGE_SECONDS * 1000 + 1)).toBeNull();

        vi.unstubAllEnvs();
    });
});
