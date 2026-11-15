import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render EcoUrba brand header', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('EcoUrba');
  });

  it('should return correct colors for heat island risk levels', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app.getDistrictColor('Bajo')).toBe('#4caf50');
    expect(app.getDistrictColor('Moderado')).toBe('#ffeb3b');
    expect(app.getDistrictColor('Alto')).toBe('#ff9800');
    expect(app.getDistrictColor('Crítico')).toBe('#f44336');
  });

  it('should compute top5Districts sorted by tree_canopy_pct descending', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.districts.set([
      { id: 1, name: 'D1', zone: 'N', has_fixed_sensor: false, centroid: { latitude: 0, longitude: 0 }, bbox: [0,0,0,0], microclimate: { ndvi_index: 0.1, surface_temp_c: 30, heat_island_risk: 'Alto', tree_canopy_pct: 10, resilience_action: '' } },
      { id: 2, name: 'D2', zone: 'N', has_fixed_sensor: false, centroid: { latitude: 0, longitude: 0 }, bbox: [0,0,0,0], microclimate: { ndvi_index: 0.2, surface_temp_c: 25, heat_island_risk: 'Bajo', tree_canopy_pct: 35, resilience_action: '' } },
      { id: 3, name: 'D3', zone: 'N', has_fixed_sensor: false, centroid: { latitude: 0, longitude: 0 }, bbox: [0,0,0,0], microclimate: { ndvi_index: 0.15, surface_temp_c: 28, heat_island_risk: 'Moderado', tree_canopy_pct: 20, resilience_action: '' } },
      { id: 4, name: 'D4', zone: 'N', has_fixed_sensor: false, centroid: { latitude: 0, longitude: 0 }, bbox: [0,0,0,0], microclimate: { ndvi_index: 0.05, surface_temp_c: 35, heat_island_risk: 'Crítico', tree_canopy_pct: 5, resilience_action: '' } },
      { id: 5, name: 'D5', zone: 'N', has_fixed_sensor: false, centroid: { latitude: 0, longitude: 0 }, bbox: [0,0,0,0], microclimate: { ndvi_index: 0.18, surface_temp_c: 27, heat_island_risk: 'Moderado', tree_canopy_pct: 25, resilience_action: '' } },
      { id: 6, name: 'D6', zone: 'N', has_fixed_sensor: false, centroid: { latitude: 0, longitude: 0 }, bbox: [0,0,0,0], microclimate: { ndvi_index: 0.3, surface_temp_c: 24, heat_island_risk: 'Bajo', tree_canopy_pct: 40, resilience_action: '' } },
    ]);

    const top5 = app.top5Districts();
    expect(top5.length).toBe(5);
    expect(top5[0].id).toBe(6); // 40%
    expect(top5[1].id).toBe(2); // 35%
    expect(top5[2].id).toBe(5); // 25%
    expect(top5[3].id).toBe(3); // 20%
    expect(top5[4].id).toBe(1); // 10%
  });
});
