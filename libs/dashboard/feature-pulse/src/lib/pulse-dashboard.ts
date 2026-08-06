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
import { PulseStore } from '@standup-pulse/dashboard-data-access';
import { RuntimeState, StatusPillComponent } from '@standup-pulse/dashboard-ui';
import { filter, map, startWith } from 'rxjs';
import { CopilotPanelComponent } from './components/copilot-panel';
import { NudgeFeedbackComponent } from './components/nudge-feedback';
import { DashboardUiStore } from './dashboard-ui.store';
import { DEFAULT_PULSE_TIME_ZONE, todayIn } from './pulse-date';

type DashboardRoute = 'today' | 'team' | 'history' | 'settings';

function dashboardRouteFromUrl(url: string): DashboardRoute {
  const route = url.split(/[?(;]/, 1)[0].split('/').filter(Boolean)[0];
  return route === 'team' || route === 'history' || route === 'settings'
    ? route
    : 'today';
}

@Component({
  selector: 'lib-standup-pulse-dashboard',
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
  template: `
    <div class="pulse-app">
      <aside
        class="pulse-navigation"
        [class.pulse-navigation--open]="ui.mobileNavigationOpen()"
      >
        <a
          class="pulse-brand"
          [routerLink]="[{ outlets: { primary: ['today'], modal: null } }]"
          (click)="closeNavigation()"
        >
          <span class="pulse-brand__mark" aria-hidden="true">
            <ng-icon [svg]="icons.bolt" size="23" strokeWidth="1.9" />
          </span>
          <span>Standup Pulse</span>
        </a>

        <nav class="pulse-nav-list" aria-label="Primary navigation">
          @for (item of navigation; track item.path) {
            <a
              class="pulse-nav-item"
              [routerLink]="[
                { outlets: { primary: [item.path], modal: null } },
              ]"
              routerLinkActive="pulse-nav-item--active"
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

        <div class="pulse-team-switcher">
          <ng-icon
            class="pulse-team-switcher__icon"
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

      @if (ui.mobileNavigationOpen()) {
        <button
          class="pulse-mobile-backdrop"
          type="button"
          aria-label="Close navigation"
          (click)="ui.closeMobileNavigation()"
        ></button>
      }

      <main
        id="daily-pulse"
        class="pulse-main"
        [class.pulse-main--chat-open]="ui.chatOpen()"
        tabindex="-1"
      >
        <header class="pulse-header">
          <div class="pulse-header__title-row">
            <button
              class="btn btn-square btn-ghost pulse-menu-button"
              type="button"
              aria-label="Open navigation"
              (click)="ui.toggleMobileNavigation()"
            >
              <ng-icon [svg]="icons.menu" size="23" strokeWidth="1.8" />
            </button>
            <div>
              <h1>{{ viewTitle() }}</h1>
              <p>{{ viewSubtitle() }}</p>
            </div>
          </div>

          <div class="pulse-header__actions" aria-label="Service status">
            <lib-pulse-status-pill
              label="Slack"
              [state]="componentState('channel')"
              [detail]="store.services()?.channel?.message"
            />
            <lib-pulse-status-pill
              [label]="modelLabel()"
              [state]="componentState('model')"
              [detail]="store.services()?.model?.message"
            />
            <button
              class="btn btn-sm btn-outline pulse-chat-toggle"
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

      <lib-pulse-nudge-feedback />
      <router-outlet name="modal" />
      <lib-pulse-copilot-panel />
    </div>
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

  protected readonly activeRoute = computed(
    () => this.routePath() as DashboardRoute,
  );
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
}
