import {describe, expect, it} from "vitest";
import {
    isValidEmail,
    isValidFullName,
    isValidPassword,
    isValidTickerSymbol,
    normalizeEmail,
    normalizeSymbol,
} from "@/lib/validation";

describe("validation helpers", () => {
    it("normalizes email addresses before validation", () => {
        expect(normalizeEmail("  User.Name+updates@Example.COM ")).toBe("user.name+updates@example.com");
        expect(isValidEmail("  User.Name+updates@Example.COM ")).toBe(true);
    });

    it("rejects malformed email addresses", () => {
        expect(isValidEmail("missing-domain@")).toBe(false);
        expect(isValidEmail("missing-at.example.com")).toBe(false);
    });

    it("enforces meaningful sign-up names and passwords", () => {
        expect(isValidFullName("A")).toBe(false);
        expect(isValidFullName("Ada Lovelace")).toBe(true);
        expect(isValidPassword("short")).toBe(false);
        expect(isValidPassword("long-enough")).toBe(true);
    });

    it("normalizes and validates ticker symbols", () => {
        expect(normalizeSymbol(" ms ft ")).toBe("MSFT");
        expect(isValidTickerSymbol("brk.b")).toBe(true);
        expect(isValidTickerSymbol("bad symbol!")).toBe(false);
    });
});
