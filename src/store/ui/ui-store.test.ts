import { beforeEach, describe, expect, it } from "vitest";
import { useUIStore } from "./ui-store";

describe("useUIStore", () => {
	beforeEach(() => {
		useUIStore.setState({ isDialogOpen: false, isSidebarOpen: false });
	});

	it("opens and closes the dialog", () => {
		useUIStore.getState().openDialog();
		expect(useUIStore.getState().isDialogOpen).toBe(true);

		useUIStore.getState().closeDialog();
		expect(useUIStore.getState().isDialogOpen).toBe(false);
	});

	it("opens and closes the sidebar without affecting the dialog", () => {
		useUIStore.getState().openSidebar();
		expect(useUIStore.getState().isSidebarOpen).toBe(true);
		expect(useUIStore.getState().isDialogOpen).toBe(false);

		useUIStore.getState().closeSidebar();
		expect(useUIStore.getState().isSidebarOpen).toBe(false);
	});
});
