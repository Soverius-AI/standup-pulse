import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';

interface DashboardUiState {
  chatOpen: boolean;
  mobileNavigationOpen: boolean;
  selectedBlockerId: string | null;
}

const initialState: DashboardUiState = {
  chatOpen: false,
  mobileNavigationOpen: false,
  selectedBlockerId: null,
};

export const DashboardUiStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store) => ({
    toggleChat(): void {
      patchState(store, { chatOpen: !store.chatOpen() });
    },
    closeChat(): void {
      patchState(store, { chatOpen: false });
    },
    toggleMobileNavigation(): void {
      patchState(store, {
        mobileNavigationOpen: !store.mobileNavigationOpen(),
      });
    },
    closeMobileNavigation(): void {
      patchState(store, { mobileNavigationOpen: false });
    },
    selectBlocker(selectedBlockerId: string): void {
      patchState(store, { selectedBlockerId });
    },
    clearSelectedBlocker(): void {
      patchState(store, { selectedBlockerId: null });
    },
  })),
);
