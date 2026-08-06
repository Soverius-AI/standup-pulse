import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { CopilotChat } from '@copilotkit/angular';
import { NgIcon } from '@ng-icons/core';
import { heroXMark } from '@ng-icons/heroicons/outline';
import { PulseStore } from '@standup-pulse/dashboard-data-access';
import { DashboardUiStore } from '../dashboard-ui.store';
import { registerStandupWhatIfTool } from './standup-what-if-tool';

@Component({
  selector: 'lib-pulse-copilot-panel',
  imports: [CopilotChat, NgIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (ui.chatOpen()) {
      <button
        class="pulse-chat-backdrop"
        type="button"
        aria-label="Close Standup Copilot"
        (click)="ui.closeChat()"
      ></button>
    }
    <aside
      class="pulse-chat"
      [class.pulse-chat--open]="ui.chatOpen()"
      [attr.aria-hidden]="ui.chatOpen() ? null : true"
      [attr.inert]="ui.chatOpen() ? null : ''"
      aria-label="Standup Copilot"
      data-chat-mounted
    >
      <header class="pulse-chat__header">
        <div>
          <h2>Standup Copilot</h2>
          <p>
            <span class="pulse-status-dot" aria-hidden="true"></span>
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
      <div class="pulse-chat__body">
        <copilot-chat agentId="standupPulse" />
      </div>
    </aside>
  `,
})
export class CopilotPanelComponent {
  protected readonly store = inject(PulseStore);
  protected readonly ui = inject(DashboardUiStore);
  protected readonly closeIcon = heroXMark;

  constructor() {
    registerStandupWhatIfTool();
  }

  protected readonly statusLabel = computed(() => {
    const state = this.store.services()?.agent.state;
    return state === 'online'
      ? 'Online'
      : state === 'degraded'
        ? 'Degraded'
        : 'Connecting';
  });
}
