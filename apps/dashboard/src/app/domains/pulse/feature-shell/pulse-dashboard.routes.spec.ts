import { parseMemberModalMode } from '../feature-team/member-editor-route';
import { PULSE_DASHBOARD_ROUTES } from './pulse-dashboard.routes';

describe('PULSE_DASHBOARD_ROUTES', () => {
  it('owns the dashboard pages as lazy primary routes', () => {
    const children = PULSE_DASHBOARD_ROUTES[0]?.children ?? [];
    const primaryPaths = children
      .filter(({ outlet }) => !outlet)
      .map(({ path }) => path);

    expect(primaryPaths).toEqual(['today', 'team', 'history', 'settings', '']);
    expect(
      children
        .filter(({ path }) =>
          ['today', 'team', 'history', 'settings'].includes(path ?? ''),
        )
        .every(({ loadComponent }) => Boolean(loadComponent)),
    ).toBe(true);
  });

  it('renders create and edit member routes in the named modal outlet', () => {
    const modalRoutes = (PULSE_DASHBOARD_ROUTES[0]?.children ?? []).filter(
      ({ outlet }) => outlet === 'modal',
    );

    expect(modalRoutes.map(({ path }) => path)).toEqual([
      'member/new',
      'member/:memberId/edit',
    ]);
    expect(
      modalRoutes.map(({ data }) => parseMemberModalMode(data ?? {})),
    ).toEqual(['create', 'edit']);
  });
});
