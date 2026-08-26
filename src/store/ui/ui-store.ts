import { create } from "zustand";

interface State {
	isDialogOpen: boolean;
	openDialog: () => void;
	closeDialog: () => void;
}

export const useUIStore = create<State>()((set) => ({
	isDialogOpen: false,
	openDialog: () => set({ isDialogOpen: true }),
	closeDialog: () => set({ isDialogOpen: false }),
}));
