import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { PulseStore } from '@standup-pulse/dashboard-data-access';
import { DEFAULT_PULSE_TIME_ZONE, todayIn } from './pulse-date';

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
          import('./pages/today-page').then(
            ({ TodayPageComponent }) => TodayPageComponent,
          ),
      },
      {
        path: 'team',
        title: 'Team · Standup Pulse',
        loadComponent: () =>
          import('./pages/team-page').then(
            ({ TeamPageComponent }) => TeamPageComponent,
          ),
      },
      {
        path: 'history',
        title: 'History · Standup Pulse',
        loadComponent: () =>
          import('./pages/history-page').then(
            ({ HistoryPageComponent }) => HistoryPageComponent,
          ),
      },
      {
        path: 'settings',
        title: 'Settings · Standup Pulse',
        loadComponent: () =>
          import('./pages/settings-page').then(
            ({ SettingsPageComponent }) => SettingsPageComponent,
          ),
      },
      {
        path: 'member/new',
        outlet: 'modal',
        loadComponent: () =>
          import('./modals/member-editor-modal').then(
            ({ MemberEditorModalComponent }) => MemberEditorModalComponent,
          ),
        data: { mode: 'create' },
      },
      {
        path: 'member/:memberId/edit',
        outlet: 'modal',
        loadComponent: () =>
          import('./modals/member-editor-modal').then(
            ({ MemberEditorModalComponent }) => MemberEditorModalComponent,
          ),
        data: { mode: 'edit' },
      },
      { path: '', pathMatch: 'full', redirectTo: 'today' },
    ],
  },
];
