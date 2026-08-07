import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { PulseStore } from '../data/pulse.store';
import { memberModalRouteData } from '../feature-team/member-editor-route';
import { DEFAULT_PULSE_TIME_ZONE, todayIn } from '../util/pulse-date';

function loadInitialPulse(): true {
  inject(PulseStore).loadForDate(todayIn(DEFAULT_PULSE_TIME_ZONE));
  return true;
}

export const PULSE_DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pulse-dashboard').then(
        ({ PulseDashboardComponent }) => PulseDashboardComponent,
      ),
    resolve: { initialPulse: loadInitialPulse },
    children: [
      {
        path: 'today',
        title: 'Daily pulse · Standup Pulse',
        loadComponent: () =>
          import('../feature-today/today-page').then(
            ({ TodayPageComponent }) => TodayPageComponent,
          ),
      },
      {
        path: 'team',
        title: 'Team · Standup Pulse',
        loadComponent: () =>
          import('../feature-team/team-page').then(
            ({ TeamPageComponent }) => TeamPageComponent,
          ),
      },
      {
        path: 'history',
        title: 'History · Standup Pulse',
        loadComponent: () =>
          import('../feature-history/history-page').then(
            ({ HistoryPageComponent }) => HistoryPageComponent,
          ),
      },
      {
        path: 'settings',
        title: 'Settings · Standup Pulse',
        loadComponent: () =>
          import('../feature-settings/settings-page').then(
            ({ SettingsPageComponent }) => SettingsPageComponent,
          ),
      },
      {
        path: 'member/new',
        outlet: 'modal',
        loadComponent: () =>
          import('../feature-team/member-editor-modal').then(
            ({ MemberEditorModalComponent }) => MemberEditorModalComponent,
          ),
        data: memberModalRouteData('create'),
      },
      {
        path: 'member/:memberId/edit',
        outlet: 'modal',
        loadComponent: () =>
          import('../feature-team/member-editor-modal').then(
            ({ MemberEditorModalComponent }) => MemberEditorModalComponent,
          ),
        data: memberModalRouteData('edit'),
      },
      { path: '', pathMatch: 'full', redirectTo: 'today' },
    ],
  },
];
