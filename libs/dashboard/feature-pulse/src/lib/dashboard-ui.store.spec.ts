import { TestBed } from '@angular/core/testing';
import { DashboardUiStore } from './dashboard-ui.store';

describe('DashboardUiStore', () => {
  it('owns presentation state without mirroring server or chat messages', () => {
    const store = TestBed.inject(DashboardUiStore);

    expect(store.chatOpen()).toBe(false);
    store.toggleChat();
    expect(store.chatOpen()).toBe(true);
    store.closeChat();
    store.toggleMobileNavigation();
    store.closeMobileNavigation();
    store.selectBlocker('blocker-1');

    expect(store.chatOpen()).toBe(false);
    expect(store.mobileNavigationOpen()).toBe(false);
    expect(store.selectedBlockerId()).toBe('blocker-1');
    expect('messages' in store).toBe(false);
    expect('pulse' in store).toBe(false);
  });
});
