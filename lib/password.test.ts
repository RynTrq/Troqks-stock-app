import {describe, expect, it} from "vitest";
import {hashPassword, verifyPassword} from "@/lib/password";

describe("password helpers", () => {
    it("hashes passwords without storing the original value", async () => {
        const hash = await hashPassword("correct horse battery staple");

        expect(hash).not.toContain("correct horse battery staple");
        expect(hash.split(":")).toHaveLength(3);
    });

    it("verifies matching passwords and rejects mismatches", async () => {
        const hash = await hashPassword("correct horse battery staple");

        await expect(verifyPassword("correct horse battery staple", hash)).resolves.toBe(true);
        await expect(verifyPassword("wrong password", hash)).resolves.toBe(false);
    });
});
