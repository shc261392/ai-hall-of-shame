import { describe, it, expect } from "vitest";
import { isReservedUsername, generateUsername } from "./username";

describe("isReservedUsername", () => {
it("returns true for known reserved names", () => {
expect(isReservedUsername("admin")).toBe(true);
expect(isReservedUsername("moderator")).toBe(true);
expect(isReservedUsername("system")).toBe(true);
expect(isReservedUsername("root")).toBe(true);
expect(isReservedUsername("deleted")).toBe(true);
});

it("is case insensitive", () => {
expect(isReservedUsername("Admin")).toBe(true);
expect(isReservedUsername("ADMIN")).toBe(true);
expect(isReservedUsername("Moderator")).toBe(true);
});

it("returns false for non-reserved names", () => {
expect(isReservedUsername("cool-user")).toBe(false);
expect(isReservedUsername("john")).toBe(false);
expect(isReservedUsername("notadmin")).toBe(false);
});
});

describe("generateUsername", () => {
it("returns a string in adj-noun-NNNN format", async () => {
const username = await generateUsername("test-credential-id");
expect(username).toMatch(/^[a-z]+-[a-z]+-\d{4}$/);
});

it("is deterministic (same input = same output)", async () => {
const a = await generateUsername("same-id");
const b = await generateUsername("same-id");
expect(a).toBe(b);
});

it("produces different output with different salt", async () => {
const a = await generateUsername("cred-id", 0);
const b = await generateUsername("cred-id", 1);
expect(a).not.toBe(b);
});

it("uses salt=0 by default (no salt appended)", async () => {
const a = await generateUsername("my-cred");
const b = await generateUsername("my-cred", 0);
expect(a).toBe(b);
});

it("produces different usernames for different credential IDs", async () => {
const a = await generateUsername("cred-1");
const b = await generateUsername("cred-2");
expect(a).not.toBe(b);
});
});
