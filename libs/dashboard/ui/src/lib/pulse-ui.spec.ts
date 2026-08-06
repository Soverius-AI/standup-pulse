import { TestBed } from '@angular/core/testing';
import { ParticipationChartComponent } from './pulse-ui';

describe('ParticipationChartComponent', () => {
  it('exposes an accessible text equivalent for every bar', async () => {
    await TestBed.configureTestingModule({
      imports: [ParticipationChartComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(ParticipationChartComponent);
    fixture.componentRef.setInput('points', [
      { date: '2026-08-05', participationPct: 75 },
      { date: '2026-08-06', participationPct: 92 },
    ]);
    await fixture.whenStable();

    const chart = fixture.nativeElement.querySelector('[role="img"]');
    expect(chart.getAttribute('aria-label')).toContain('75 percent');
    expect(fixture.nativeElement.querySelectorAll('tbody tr')).toHaveLength(2);
  });
});
