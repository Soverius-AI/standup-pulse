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
import { PulseStore } from '../data/pulse.store';
import { RuntimeState } from '../ui/types';
import { DEFAULT_PULSE_TIME_ZONE } from '../util/pulse-date';

@Component({
  selector: 'app-pulse-settings-page',
  imports: [NgIcon],
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto w-full max-w-6xl" aria-labelledby="settings-title">
      <div
        class="card card-border mb-4 min-h-26 flex-row items-center justify-between gap-6 bg-base-100/90 p-5 shadow-sm @max-2xl/main:flex-col @max-2xl/main:items-start"
      >
        <div>
          <p
            class="text-2xs font-extrabold uppercase tracking-widest text-primary"
          >
            Workspace
          </p>
          <h2
            id="settings-title"
            class="mt-0.5 text-xl font-extrabold tracking-tight"
          >
            Settings
          </h2>
          <p class="mt-1 text-xs text-base-content/60">
            Current runtime and standup configuration.
          </p>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3.5 @max-2xl/main:grid-cols-1">
        @for (card of cards(); track card.title) {
          <article
            class="card card-border min-w-0 flex-row items-center gap-3.5 bg-base-100/90 p-5 shadow-sm"
          >
            <span
              class="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"
            >
              <ng-icon [svg]="card.icon" size="21" strokeWidth="1.8" />
            </span>
            <div class="min-w-0">
              <p class="text-xs font-semibold text-base-content/55">
                {{ card.title }}
              </p>
              <h3 class="mt-0.5 truncate text-sm font-bold">
                {{ card.value }}
              </h3>
              <span class="text-2xs capitalize text-base-content/50">{{
                card.detail
              }}</span>
            </div>
          </article>
        }
      </div>
    </section>
  `,
})
export class SettingsPageComponent {
  protected readonly store = inject(PulseStore);
  protected readonly timeZone = computed(
    () => this.store.pulse()?.team.timeZone ?? DEFAULT_PULSE_TIME_ZONE,
  );

  protected readonly cards = computed(() => [
    {
      title: 'Team',
      value: this.store.pulse()?.team?.name || 'Product Team',
      detail: `${this.store.roster()?.members?.length || 0} roster members`,
      icon: heroUserGroup,
    },
    {
      title: 'Standup timezone',
      value: this.timeZone(),
      detail: 'Daily pulse scheduler',
      icon: heroClock,
    },
    {
      title: 'Slack Channel',
      value: this.store.services()?.channel?.name || 'Standup Pulse',
      detail: this.componentState('channel'),
      icon: heroSignal,
    },
    {
      title: 'Local model',
      value: this.store.services()?.model?.modelId || 'Gemma 4 26B',
      detail: this.componentState('model'),
      icon: heroSparkles,
    },
  ]);

  private componentState(component: 'channel' | 'model'): RuntimeState {
    return this.store.services()?.[component].state ?? 'unknown';
  }
}
