import { beforeEach, describe, expect, it } from "vitest";
import { useUIStore } from "./ui-store";

describe("useUIStore", () => {
	beforeEach(() => {
		useUIStore.setState({ isDialogOpen: false });
	});

	it("opens and closes the dialog", () => {
		useUIStore.getState().openDialog();
		expect(useUIStore.getState().isDialogOpen).toBe(true);

		useUIStore.getState().closeDialog();
		expect(useUIStore.getState().isDialogOpen).toBe(false);
	});
});
