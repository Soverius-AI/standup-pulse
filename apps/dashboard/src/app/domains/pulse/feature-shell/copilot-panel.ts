import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { CopilotChat } from '@copilotkit/angular';
import { NgIcon } from '@ng-icons/core';
import { heroXMark } from '@ng-icons/heroicons/outline';
import { PulseStore } from '../data/pulse.store';
import { DashboardUiStore } from '../data/dashboard-ui.store';
import { STANDUP_DASHBOARD_AGENT_ID } from '@standup-pulse/shared-contracts';
import { CopilotComposerLayoutDirective } from './copilot-composer-layout.directive';

@Component({
  selector: 'app-pulse-copilot-panel',
  imports: [CopilotChat, CopilotComposerLayoutDirective, NgIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (ui.chatOpen()) {
      <button
        class="fixed inset-0 z-[45] hidden bg-[#071d39]/30 backdrop-blur-xs max-md:block"
        type="button"
        aria-label="Close Standup Copilot"
        (click)="ui.closeChat()"
      ></button>
    }
    <aside
      class="pulse-chat fixed inset-y-0 right-0 z-50 grid w-[min(23.75rem,calc(100vw-1rem))] grid-rows-[5.125rem_minmax(0,1fr)] border-l border-base-300 bg-base-100 shadow-[-1rem_0_2.625rem_rgb(21_35_67/12%)] transition-[transform,opacity,visibility] duration-200 max-md:inset-y-2 max-md:right-2 max-md:h-[calc(100dvh-1rem)] max-md:rounded-xl max-md:border"
      [class]="
        ui.chatOpen()
          ? 'visible translate-x-0 opacity-100'
          : 'pointer-events-none invisible translate-x-[102%] opacity-0'
      "
      [attr.aria-hidden]="ui.chatOpen() ? null : true"
      [attr.inert]="ui.chatOpen() ? null : ''"
      aria-label="Standup Copilot"
      data-chat-mounted
    >
      <header
        class="pulse-chat__header flex items-center justify-between border-b border-base-300 px-4.5"
      >
        <div>
          <h2 class="text-lg font-extrabold tracking-tight">Standup Copilot</h2>
          <p class="mt-0.5 text-xs font-semibold text-success">
            <span
              class="status status-success mr-0.5"
              aria-hidden="true"
            ></span>
            {{ statusLabel() }}
          </p>
        </div>
        <button
          class="btn btn-sm btn-circle btn-ghost"
          type="button"
          aria-label="Close Standup Copilot"
          (click)="ui.closeChat()"
        >
          <ng-icon [svg]="closeIcon" size="20" strokeWidth="2" />
        </button>
      </header>
      <div
        class="pulse-chat__body min-h-0 min-w-0 overflow-hidden"
        appPulseCopilotComposerLayout
      >
        <copilot-chat [agentId]="dashboardAgentId" />
      </div>
    </aside>
  `,
})
export class CopilotPanelComponent {
  protected readonly store = inject(PulseStore);
  protected readonly ui = inject(DashboardUiStore);
  protected readonly closeIcon = heroXMark;
  protected readonly dashboardAgentId = STANDUP_DASHBOARD_AGENT_ID;

  protected readonly statusLabel = computed(() => {
    const state = this.store.services()?.agent.state;
    return state === 'online'
      ? 'Online'
      : state === 'degraded'
        ? 'Degraded'
        : 'Connecting';
  });
}
