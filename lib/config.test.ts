import {afterEach, describe, expect, it, vi} from "vitest";
import {getAuthConfigurationError} from "@/lib/config";

describe("configuration helpers", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("requires MongoDB for auth routes", () => {
        vi.stubEnv("MONGODB_URI", "");

        expect(getAuthConfigurationError()).toContain("MONGODB_URI");
    });

    it("accepts a development MongoDB config without an auth secret", () => {
        vi.stubEnv("NODE_ENV", "development");
        vi.stubEnv("MONGODB_URI", "mongodb://localhost:27017/troqks");
        vi.stubEnv("AUTH_SECRET", "");

        expect(getAuthConfigurationError()).toBeNull();
    });

    it("rejects short auth secrets", () => {
        vi.stubEnv("MONGODB_URI", "mongodb://localhost:27017/troqks");
        vi.stubEnv("AUTH_SECRET", "short");

        expect(getAuthConfigurationError()).toContain("32 characters");
    });
});
