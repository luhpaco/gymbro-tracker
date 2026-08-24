import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
	it("merges plain class names", () => {
		expect(cn("px-2", "py-1")).toBe("px-2 py-1");
	});

	it("drops falsy/conditional class names", () => {
		expect(cn("base", false && "hidden", undefined, null, "visible")).toBe(
			"base visible",
		);
	});

	it("resolves conflicting Tailwind classes, keeping the last one", () => {
		expect(cn("px-2", "px-4")).toBe("px-4");
	});

	it("merges conditional object syntax from clsx", () => {
		expect(cn({ block: true, hidden: false })).toBe("block");
	});
});
