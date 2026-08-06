import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import {
  heroClock,
  heroSignal,
  heroSparkles,
  heroUserGroup,
} from '@ng-icons/heroicons/outline';
import { PulseStore } from '@standup-pulse/dashboard-data-access';
import { RuntimeState } from '@standup-pulse/dashboard-ui';
import { DEFAULT_PULSE_TIME_ZONE } from '../pulse-date';

@Component({
  selector: 'lib-pulse-settings-page',
  imports: [NgIcon],
  host: { class: 'pulse-route-page' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="pulse-view" aria-labelledby="settings-title">
      <div class="pulse-view__toolbar">
        <div>
          <p class="pulse-card__eyebrow">Workspace</p>
          <h2 id="settings-title">Settings</h2>
          <p>Current runtime and standup configuration.</p>
        </div>
      </div>
      <div class="settings-grid">
        <article class="settings-card">
          <span class="settings-card__icon">
            <ng-icon [svg]="icons.userGroup" size="21" strokeWidth="1.8" />
          </span>
          <div>
            <p>Team</p>
            <h3>{{ store.pulse()?.team?.name || 'Product Team' }}</h3>
            <span
              >{{ store.roster()?.members?.length || 0 }} roster members</span
            >
          </div>
        </article>
        <article class="settings-card">
          <span class="settings-card__icon">
            <ng-icon [svg]="icons.clock" size="21" strokeWidth="1.8" />
          </span>
          <div>
            <p>Standup timezone</p>
            <h3>{{ timeZone() }}</h3>
            <span>Daily pulse scheduler</span>
          </div>
        </article>
        <article class="settings-card">
          <span class="settings-card__icon">
            <ng-icon [svg]="icons.signal" size="21" strokeWidth="1.8" />
          </span>
          <div>
            <p>Slack Channel</p>
            <h3>{{ store.services()?.channel?.name || 'Standup Pulse' }}</h3>
            <span>{{ componentState('channel') }}</span>
          </div>
        </article>
        <article class="settings-card">
          <span class="settings-card__icon">
            <ng-icon [svg]="icons.sparkles" size="21" strokeWidth="1.8" />
          </span>
          <div>
            <p>Local model</p>
            <h3>{{ store.services()?.model?.modelId || 'Gemma 4 26B' }}</h3>
            <span>{{ componentState('model') }}</span>
          </div>
        </article>
      </div>
    </section>
  `,
})
export class SettingsPageComponent {
  protected readonly store = inject(PulseStore);
  protected readonly icons = {
    userGroup: heroUserGroup,
    clock: heroClock,
    signal: heroSignal,
    sparkles: heroSparkles,
  } as const;
  protected readonly timeZone = computed(
    () => this.store.pulse()?.team.timeZone ?? DEFAULT_PULSE_TIME_ZONE,
  );

  protected componentState(component: 'channel' | 'model'): RuntimeState {
    return this.store.services()?.[component].state ?? 'unknown';
  }
}
