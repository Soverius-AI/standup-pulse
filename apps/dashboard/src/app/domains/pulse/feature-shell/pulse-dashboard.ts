import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import {
  heroBars3,
  heroBolt,
  heroChevronDown,
  heroClock,
  heroCog6Tooth,
  heroHome,
  heroSparkles,
  heroUserGroup,
  heroUsers,
} from '@ng-icons/heroicons/outline';
import { PulseStore } from '../data/pulse.store';
import { StatusPillComponent } from '../ui/status-pill';
import { RuntimeState } from '../ui/types';
import { filter, map, startWith } from 'rxjs';
import { CopilotPanelComponent } from './copilot-panel';
import { NudgeFeedbackComponent } from './nudge-feedback';
import { DashboardUiStore } from '../data/dashboard-ui.store';
import { DEFAULT_PULSE_TIME_ZONE, todayIn } from '../util/pulse-date';

type DashboardRoute = 'today' | 'team' | 'history' | 'settings';

function dashboardRouteFromUrl(url: string): DashboardRoute {
  const route = url.split(/[?(;]/, 1).at(0)?.split('/').filter(Boolean).at(0);
  return route === 'team' || route === 'history' || route === 'settings'
    ? route
    : 'today';
}

@Component({
  selector: 'app-standup-pulse-dashboard',
  imports: [
    CopilotPanelComponent,
    NgIcon,
    NudgeFeedbackComponent,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    StatusPillComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './pulse-dashboard.css',
  template: `
    <div class="drawer min-h-dvh md:drawer-open">
      <input
        id="pulse-navigation-drawer"
        type="checkbox"
        class="drawer-toggle"
        [checked]="ui.mobileNavigationOpen()"
        (change)="syncNavigation($event)"
      />

      <div class="drawer-content">
        <main
          id="daily-pulse"
          class="@container/main min-h-dvh px-7.5 pt-6.5 pb-12 transition-[margin-right] duration-200 max-md:px-3.5 max-md:pt-4.5 max-md:pb-10"
          [class]="ui.chatOpen() ? 'min-[75rem]:mr-[23.75rem]' : ''"
          tabindex="-1"
        >
          <header
            class="mx-auto mb-5.5 flex max-w-6xl items-start justify-between gap-5 max-md:items-center"
          >
            <div class="flex items-start gap-2.5 max-md:items-center">
              <button
                class="btn btn-square btn-ghost md:hidden"
                type="button"
                aria-label="Open navigation"
                (click)="ui.toggleMobileNavigation()"
              >
                <ng-icon [svg]="icons.menu" size="23" strokeWidth="1.8" />
              </button>
              <div>
                <h1
                  class="text-3xl font-extrabold tracking-tighter max-[32rem]:text-2xl"
                >
                  {{ viewTitle() }}
                </h1>
                <p
                  class="mt-1 text-sm text-base-content/60 max-[32rem]:max-w-48 max-[32rem]:text-xs"
                >
                  {{ viewSubtitle() }}
                </p>
              </div>
            </div>

            <div
              class="flex flex-wrap items-center justify-end gap-2"
              aria-label="Service status"
            >
              <app-pulse-status-pill
                class="max-md:hidden"
                label="Slack"
                [state]="componentState('channel')"
                [detail]="store.services()?.channel?.message"
              />
              <app-pulse-status-pill
                class="max-md:hidden"
                [label]="modelLabel()"
                [state]="componentState('model')"
                [detail]="store.services()?.model?.message"
              />
              <button
                class="btn btn-sm btn-outline max-[32rem]:w-9.5 max-[32rem]:overflow-hidden max-[32rem]:whitespace-nowrap max-[32rem]:px-2.5"
                type="button"
                (click)="ui.toggleChat()"
                [attr.aria-expanded]="ui.chatOpen()"
              >
                <ng-icon [svg]="icons.sparkles" size="18" strokeWidth="1.8" />
                <span>Copilot</span>
              </button>
            </div>
          </header>

          <router-outlet />
        </main>
      </div>

      <div class="drawer-side z-[60]">
        <label
          for="pulse-navigation-drawer"
          class="drawer-overlay"
          aria-label="Close navigation"
        ></label>
        <aside
          class="pulse-sidebar flex min-h-full w-52 flex-col px-3.5 pt-5.5 pb-4.5 text-white max-md:w-[min(17rem,84vw)]"
        >
          <a
            class="flex items-center gap-2.5 px-1 pt-1 pb-7.5 text-lg font-bold tracking-tight"
            [routerLink]="[{ outlets: { primary: ['today'], modal: null } }]"
            (click)="closeNavigation()"
          >
            <span
              class="pulse-brand-mark grid size-10.5 place-items-center rounded-full border border-white/20 text-3xl"
              aria-hidden="true"
            >
              <ng-icon [svg]="icons.bolt" size="23" strokeWidth="1.9" />
            </span>
            <span>Standup Pulse</span>
          </a>

          <nav class="grid gap-2" aria-label="Primary navigation">
            @for (item of navigation; track item.path) {
              <a
                class="pulse-nav-item flex min-h-12 items-center gap-3.5 rounded-lg px-3.5 text-sm font-semibold"
                [routerLink]="[
                  { outlets: { primary: [item.path], modal: null } },
                ]"
                routerLinkActive="pulse-nav-active"
                [routerLinkActiveOptions]="{ exact: true }"
                #activeLink="routerLinkActive"
                [attr.aria-current]="activeLink.isActive ? 'page' : null"
                (click)="closeNavigation()"
              >
                <ng-icon [svg]="item.icon" size="20" strokeWidth="1.8" />
                <span>{{ item.label }}</span>
              </a>
            }
          </nav>

          <div
            class="mt-auto flex min-h-14.5 items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-3 text-xs font-bold"
          >
            <ng-icon
              class="text-xl"
              [svg]="icons.userGroup"
              size="20"
              strokeWidth="1.8"
            />
            <span class="min-w-0 truncate">{{
              store.pulse()?.team?.name || 'Product Team'
            }}</span>
            <ng-icon [svg]="icons.chevronDown" size="16" strokeWidth="2" />
          </div>
        </aside>
      </div>
    </div>

    <app-pulse-nudge-feedback />
    <router-outlet name="modal" />
    <app-pulse-copilot-panel />
  `,
})
export class PulseDashboardComponent {
  protected readonly store = inject(PulseStore);
  protected readonly ui = inject(DashboardUiStore);
  private readonly router = inject(Router);
  private readonly defaultTimeZone = DEFAULT_PULSE_TIME_ZONE;
  private readonly today = todayIn(this.defaultTimeZone);

  protected readonly icons = {
    bolt: heroBolt,
    menu: heroBars3,
    sparkles: heroSparkles,
    userGroup: heroUserGroup,
    chevronDown: heroChevronDown,
  } as const;

  protected readonly navigation = [
    { path: 'today', label: 'Today', icon: heroHome },
    { path: 'team', label: 'Team', icon: heroUsers },
    { path: 'history', label: 'History', icon: heroClock },
    { path: 'settings', label: 'Settings', icon: heroCog6Tooth },
  ] as const;

  private readonly routePath = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(({ urlAfterRedirects }) => dashboardRouteFromUrl(urlAfterRedirects)),
      startWith(dashboardRouteFromUrl(this.router.url)),
    ),
    { initialValue: 'today' },
  );

  protected readonly activeRoute = computed(() => this.routePath());
  protected readonly timeZone = computed(
    () => this.store.pulse()?.team.timeZone ?? this.defaultTimeZone,
  );
  protected readonly dateLabel = computed(() =>
    new Intl.DateTimeFormat('en-GB', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${this.store.selectedDate() || this.today}T00:00:00Z`)),
  );
  protected readonly viewTitle = computed(() => {
    const titles: Record<DashboardRoute, string> = {
      today: 'Daily pulse',
      team: 'Team',
      history: 'History',
      settings: 'Settings',
    };
    return titles[this.activeRoute()];
  });
  protected readonly viewSubtitle = computed(() => {
    if (this.activeRoute() === 'today') {
      return `${this.dateLabel()} · ${this.timeZone()}`;
    }
    const subtitles: Record<Exclude<DashboardRoute, 'today'>, string> = {
      team: 'Manage the people included in your daily standup',
      history: 'Review participation across recent standups',
      settings: 'Workspace, Channel, and model configuration',
    };
    return subtitles[this.activeRoute() as Exclude<DashboardRoute, 'today'>];
  });
  protected readonly modelLabel = computed(() => {
    const modelId = this.store.services()?.model.modelId;
    return modelId ? `${modelId} · local` : 'Gemma 4 · local';
  });

  protected componentState(component: 'channel' | 'model'): RuntimeState {
    return this.store.services()?.[component].state ?? 'unknown';
  }

  protected closeNavigation(): void {
    this.ui.closeMobileNavigation();
  }

  protected syncNavigation(event: Event): void {
    const open = (event.target as HTMLInputElement).checked;
    if (open !== this.ui.mobileNavigationOpen()) {
      this.ui.toggleMobileNavigation();
    }
  }
}
