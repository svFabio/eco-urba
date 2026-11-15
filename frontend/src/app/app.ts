import {
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy,
  HostListener,
  inject,
  signal,
  computed,
  ElementRef,
  viewChild,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import * as L from 'leaflet';
import {
  HEAT_RISK_COLORS,
  CANOPY_GOAL_PCT,
  CANOPY_COLOR_RAMP,
  CANOPY_GOAL_COLORS,
  DEFAULT_POLYGON_STYLE,
} from './core/theme-tokens';

export interface Centroid {
  latitude: float;
  longitude: float;
}

export interface MicroclimateProfile {
  ndvi_index: number;
  surface_temp_c: number;
  heat_island_risk: 'Crítico' | 'Alto' | 'Moderado' | 'Bajo';
  tree_canopy_pct: number;
  resilience_action: string;
  hotspot_2024_pct?: number | null;
  hotspot_2024_km2?: number | null;
}

export interface District {
  id: number;
  name: string;
  zone: string;
  has_fixed_sensor: boolean;
  station_name?: string | null;
  centroid: Centroid;
  bbox: [number, number, number, number];
  area_km2?: number | null;
  tree_canopy_pct?: number | null;
  heat_island_risk?: string | null;
  microclimate?: MicroclimateProfile | null;
}

export interface InterventionPoint {
  id: string;
  title: string;
  type: 'tree_planting' | 'health_center' | 'pocket_park';
  latitude: number;
  longitude: number;
  reason: string;
  slope_pct: number;
  elevation_m: number;
  heat_risk: string;
  priority: 'Alta' | 'Media' | 'Baja';
  buffer_distance_m: number;
}

export interface SuggestionResult {
  district_id?: number;
  district_name?: string;
  meets_goal: boolean;
  tree_canopy_pct: number;
  suggestion_text: string;
  available_areas_hint: string;
  candidate_interventions?: InterventionPoint[];
}

export interface TrendPoint {
  year: number;
  surface_temp_c: number;
  ndvi_index: number;
  canopy_pct: number;
}

export interface TrendAnalysisResult {
  district_id: number;
  district_name: string;
  sensor_fusion_type: string;
  baseline_temp_c: number;
  current_temp_c: number;
  warming_rate_c_per_decade: number;
  ndvi_change_pct: number;
  p_value: number;
  is_significant: boolean;
  divergence_classification: string;
  earth_system_diagnosis: string;
  history: TrendPoint[];
}

type float = number;

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.html',
  styleUrls: ['./app.scss'],
})
export class App implements OnInit, AfterViewInit, OnDestroy {
  private http = inject(HttpClient);
  private mapElement = viewChild<ElementRef<HTMLDivElement>>('mapContainer');

  private map?: L.Map;
  private districtLayer?: L.LayerGroup;
  private geoJsonLayer?: L.GeoJSON;
  private polygonMap = new Map<number, L.Path>();
  private activePolygon?: L.Path;
  private suggestionSub?: Subscription;
  private trendSub?: Subscription;
  private interventionsLayer = L.layerGroup();

  districts = signal<District[]>([]);
  selectedDistrict = signal<District | null>(null);
  isLoading = signal<boolean>(true);
  backendHealthy = signal<boolean>(false);
  suggestion = signal<SuggestionResult | null>(null);
  suggestionLoading = signal(false);
  districtTrend = signal<TrendAnalysisResult | null>(null);
  trendLoading = signal(false);
  currentZoom = signal(12);
  activeMetric = signal<'risk' | 'vegetation' | 'goal'>('risk');
  legendCollapsed = signal(false);
  sidebarCollapsed = signal(false);
  rightDrawerOpen = signal(false);

  toggleSidebar(): void {
    const next = !this.sidebarCollapsed();
    this.sidebarCollapsed.set(next);
    if (!next) {
      // Abre el panel izquierdo -> cierra el derecho para garantizar UN SOLO sidebar
      this.rightDrawerOpen.set(false);
    }
    setTimeout(() => {
      this.map?.invalidateSize();
    }, 320);
  }

  toggleRightDrawer(): void {
    const next = !this.rightDrawerOpen();
    this.rightDrawerOpen.set(next);
    if (next) {
      // Abre el panel derecho (Ficha/IA) -> cierra el izquierdo para garantizar UN SOLO sidebar
      this.sidebarCollapsed.set(true);
      if (!this.selectedDistrict() && this.districts().length > 0) {
        this.selectDistrict(this.districts()[0]);
      }
    }
    setTimeout(() => {
      this.map?.invalidateSize();
    }, 320);
  }

  // Comparador Temporal Satelital NASA (2016 - 2025) - Split-Screen Dual
  showComparator = signal<boolean>(false);
  comparatorVariable = signal<'ndvi' | 'lst'>('lst');
  comparatorMode = signal<'dual' | 'delta'>('dual');
  comparatorYearA = signal<number>(2016);
  comparatorYearB = signal<number>(2025);
  comparatorOpacity = signal<number>(0.85);

  private mapAElement = viewChild<ElementRef<HTMLDivElement>>('mapAContainer');
  private mapBElement = viewChild<ElementRef<HTMLDivElement>>('mapBContainer');
  private mapA?: L.Map;
  private mapB?: L.Map;
  private layerA?: L.ImageOverlay;
  private layerB?: L.ImageOverlay;
  private syncCleanup: Array<() => void> = [];
  private cachedGeoData?: any;

  readonly SATELLITE_STATS = {
    2016: { ndvi: 0.2395, lst: 29.43, n: 327874 },
    2020: { ndvi: 0.2563, lst: 26.82, n: 327874 },
    2025: { ndvi: 0.2773, lst: 26.10, n: 327874 },
  };

  comparatorDelta = computed(() => {
    const v = this.comparatorVariable();
    const a = this.comparatorYearA();
    const b = this.comparatorYearB();
    const statA = this.SATELLITE_STATS[a as keyof typeof this.SATELLITE_STATS];
    const statB = this.SATELLITE_STATS[b as keyof typeof this.SATELLITE_STATS];
    if (!statA || !statB) return { aVal: '', bVal: '', diff: '', isReduction: false };

    if (v === 'lst') {
      const d = statB.lst - statA.lst;
      return {
        aVal: `${statA.lst.toFixed(2)} °C`,
        bVal: `${statB.lst.toFixed(2)} °C`,
        diff: `${d >= 0 ? '+' : ''}${d.toFixed(2)} °C`,
        isReduction: d < 0,
      };
    } else {
      const d = statB.ndvi - statA.ndvi;
      return {
        aVal: statA.ndvi.toFixed(4),
        bVal: statB.ndvi.toFixed(4),
        diff: `${d >= 0 ? '+' : ''}${d.toFixed(4)}`,
        isReduction: d < 0,
      };
    }
  });

  top5Subtitle = computed(() => {
    const metric = this.activeMetric();
    switch (metric) {
      case 'risk':
        return 'Mayor severidad térmica (NASA LST)';
      case 'vegetation':
        return 'Mayor índice vegetal (NASA NDVI)';
      case 'goal':
      default:
        return 'Mayor cobertura arbórea (Alcaldía · GAMC)';
    }
  });

  top5Districts = computed(() => {
    const metric = this.activeMetric();
    const list = [...this.districts()];

    if (metric === 'risk') {
      return list
        .sort((a, b) => {
          const aTemp = a.microclimate?.surface_temp_c ?? 0;
          const bTemp = b.microclimate?.surface_temp_c ?? 0;
          return bTemp - aTemp;
        })
        .slice(0, 5);
    }

    if (metric === 'vegetation') {
      return list
        .sort((a, b) => {
          const aNdvi = a.microclimate?.ndvi_index ?? 0;
          const bNdvi = b.microclimate?.ndvi_index ?? 0;
          return bNdvi - aNdvi;
        })
        .slice(0, 5);
    }

    return list
      .sort((a, b) => {
        const aVal = a.tree_canopy_pct ?? a.microclimate?.tree_canopy_pct ?? 0;
        const bVal = b.tree_canopy_pct ?? b.microclimate?.tree_canopy_pct ?? 0;
        return bVal - aVal;
      })
      .slice(0, 5);
  });

  getTop5Value(d: District): string {
    const metric = this.activeMetric();
    if (metric === 'risk') {
      const temp = d.microclimate?.surface_temp_c;
      return temp != null ? `${temp.toFixed(1)} °C` : '--';
    }
    if (metric === 'vegetation') {
      const ndvi = d.microclimate?.ndvi_index;
      return ndvi != null ? `${ndvi.toFixed(2)} NDVI` : '--';
    }
    return `${this.getCanopyPct(d)}%`;
  }

  getTop5BadgeClass(d: District): string {
    const metric = this.activeMetric();
    if (metric === 'risk') {
      const risk = d.heat_island_risk || d.microclimate?.heat_island_risk;
      if (risk === 'Crítico') return 'ranking-badge-pill risk-critical';
      if (risk === 'Alto') return 'ranking-badge-pill risk-high';
      if (risk === 'Moderado') return 'ranking-badge-pill risk-medium';
      return 'ranking-badge-pill risk-low';
    }
    if (metric === 'vegetation') {
      return 'ranking-badge-pill vegetation-badge';
    }
    return 'canopy-badge';
  }

  private readonly API_BASE = (() => {
    if (typeof window !== 'undefined') {
      let customApi = (window as unknown as { __API_BASE__?: string }).__API_BASE__;
      if (customApi) {
        // Corrección de host interno privado de Render (eco-urba-api sin sufijo onrender.com)
        if (customApi.includes('://eco-urba-api/') || customApi.endsWith('://eco-urba-api')) {
          customApi = customApi.replace('://eco-urba-api', '://eco-urba-api.onrender.com');
        }
        if (customApi.trim()) {
          return customApi;
        }
      }
      const host = window.location.hostname;
      if (host === 'localhost' || host === '127.0.0.1') {
        return 'http://localhost:8000/api/v1';
      }
      if (host.includes('onrender.com')) {
        return 'https://eco-urba-api.onrender.com/api/v1';
      }
    }
    return '/api/v1';
  })();

  private readonly defaultPolygonStyle: L.PathOptions = DEFAULT_POLYGON_STYLE;

  getDistrictColor(risk: string): string {
    return HEAT_RISK_COLORS[risk] ?? HEAT_RISK_COLORS['Default'];
  }

  getFillColorForFeature(props: any): string {
    const metric = this.activeMetric();
    const risk = (props?.heat_island_risk || props?.microclimate?.heat_island_risk) as
      string | undefined;
    const canopy = props?.tree_canopy_pct ?? props?.microclimate?.tree_canopy_pct ?? 0;

    if (metric === 'vegetation') {
      const match = CANOPY_COLOR_RAMP.find((ramp) => canopy >= ramp.minCanopy);
      return match ? match.color : '#f97316';
    }

    if (metric === 'goal') {
      return canopy >= CANOPY_GOAL_PCT ? CANOPY_GOAL_COLORS.met : CANOPY_GOAL_COLORS.notMet;
    }

    return risk ? this.getDistrictColor(risk) : (this.defaultPolygonStyle.fillColor as string);
  }

  setMetric(metric: 'risk' | 'vegetation' | 'goal'): void {
    this.activeMetric.set(metric);
    this.updatePolygonColors();
  }

  toggleLegend(): void {
    this.legendCollapsed.update((v) => !v);
  }

  getDynamicFillOpacity(zoom: number, isSelected = false): number {
    if (zoom <= 12) {
      return isSelected ? 0.35 : 0.45;
    }
    if (zoom === 13) {
      return isSelected ? 0.22 : 0.32;
    }
    if (zoom === 14) {
      return isSelected ? 0.12 : 0.18;
    }
    if (zoom === 15) {
      return isSelected ? 0.06 : 0.1;
    }
    // Zoom >= 16: Vista de detalle, manzanos y viviendas totalmente despejadas
    return isSelected ? 0.03 : 0.05;
  }

  updatePolygonOpacities(): void {
    if (!this.map || !this.geoJsonLayer) return;
    const zoom = this.map.getZoom();

    this.geoJsonLayer.eachLayer((layer: any) => {
      const isSelected = this.activePolygon === layer;
      const opacity = this.getDynamicFillOpacity(zoom, isSelected);
      layer.setStyle({ fillOpacity: opacity });
    });
  }

  updateZoomState(): void {
    if (!this.map) return;
    const zoom = this.map.getZoom();
    this.currentZoom.set(zoom);
    this.updatePolygonOpacities();

    const container = this.map.getContainer();
    if (container) {
      if (zoom >= 14) {
        container.classList.remove('map-macro-view');
        container.classList.add('map-detailed-view');
      } else {
        container.classList.remove('map-detailed-view');
        container.classList.add('map-macro-view');
      }
    }
  }

  private updatePolygonColors(): void {
    if (!this.geoJsonLayer) return;
    const zoom = this.map?.getZoom() ?? 12;

    this.geoJsonLayer.eachLayer((layer: any) => {
      const props = layer.feature?.properties || {};
      const fillColor = this.getFillColorForFeature(props);
      const isSelected = this.activePolygon === layer;
      const fillOpacity = this.getDynamicFillOpacity(zoom, isSelected);

      if (isSelected) {
        layer.setStyle({ ...this.selectedPolygonStyle, fillColor, fillOpacity });
      } else {
        layer.setStyle({ ...this.defaultPolygonStyle, fillColor, fillOpacity });
      }
    });
  }

  getCanopyPct(d: District): number {
    return d.tree_canopy_pct ?? d.microclimate?.tree_canopy_pct ?? 0;
  }

  private readonly hoverPolygonStyle: L.PathOptions = {
    color: '#09090b',
    weight: 2.5,
    opacity: 1,
    fillOpacity: 0.65,
  };

  private readonly selectedPolygonStyle: L.PathOptions = {
    color: '#ffffff',
    weight: 3.5,
    opacity: 1,
    fillOpacity: 0.6,
  };

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.onGlobalKeyDown, true);
    }
    this.checkHealth();
    this.loadDistricts();
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.onGlobalKeyDown, true);
    }
    this.suggestionSub?.unsubscribe();
    this.trendSub?.unsubscribe();
    this.syncCleanup.forEach((fn) => fn());
    this.syncCleanup = [];
    if (this.mapA) {
      this.mapA.remove();
      this.mapA = undefined;
    }
    if (this.mapB) {
      this.mapB.remove();
      this.mapB = undefined;
    }
  }

  private onGlobalKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' || e.key === 'Esc' || e.keyCode === 27) {
      if (this.showComparator()) {
        e.preventDefault();
        e.stopPropagation();
        this.toggleComparator();
        return;
      }
      if (this.selectedDistrict()) {
        e.preventDefault();
        e.stopPropagation();
        this.clearSelection();
      }
    }
  };

  ngAfterViewInit(): void {
    this.initMap();
  }

  private readonly CACHE_KEY_DISTRICTS = 'ecourba_districts_cache_v2';
  private readonly CACHE_KEY_GEOJSON = 'ecourba_geojson_cache_v2';

  private getCachedItem<T>(key: string): T | null {
    try {
      const raw = sessionStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  private setCachedItem<T>(key: string, data: T): void {
    try {
      sessionStorage.setItem(key, JSON.stringify(data));
    } catch {
      // Quota or storage restriction fallback
    }
  }

  private checkHealth(): void {
    this.http.get<{ status: string }>(`${this.API_BASE}/health`).subscribe({
      next: (res) => this.backendHealthy.set(res.status === 'healthy'),
      error: () => this.backendHealthy.set(false),
    });
  }

  private loadDistricts(): void {
    // 1. Instant hydration from sessionStorage (0ms Stale-While-Revalidate)
    const cached = this.getCachedItem<District[]>(this.CACHE_KEY_DISTRICTS);
    if (cached && cached.length > 0) {
      this.districts.set(cached);
      this.isLoading.set(false);
      this.renderDistrictsOnMap(cached);
      this.loadDistrictsGeoJson();
    }

    // 2. Background revalidation from backend API (silent update without rebuilding if identical)
    this.http.get<District[]>(`${this.API_BASE}/districts`).subscribe({
      next: (data) => {
        const rawNew = JSON.stringify(data);
        const rawCached = sessionStorage.getItem(this.CACHE_KEY_DISTRICTS);
        if (rawNew !== rawCached) {
          this.setCachedItem(this.CACHE_KEY_DISTRICTS, data);
          this.districts.set(data);
          this.isLoading.set(false);
          this.renderDistrictsOnMap(data);
          this.loadDistrictsGeoJson();
        }
      },
      error: (err) => {
        if (!cached) {
          console.error('Failed to load districts from backend:', err);
          this.isLoading.set(false);
        }
      },
    });
  }

  private loadDistrictsGeoJson(): void {
    if (!this.map) return;

    // 1. Instant hydration from sessionStorage (0ms Stale-While-Revalidate)
    const cachedGeo = this.getCachedItem<any>(this.CACHE_KEY_GEOJSON);
    if (cachedGeo) {
      this.cachedGeoData = cachedGeo;
      if (!this.geoJsonLayer) {
        this.renderGeoJsonDistricts(cachedGeo);
      }
    }

    // 2. Background revalidation from backend API (silent update without destroying layer if identical)
    this.http.get<any>(`${this.API_BASE}/districts/geojson`).subscribe({
      next: (geoData) => {
        this.cachedGeoData = geoData;
        const rawNew = JSON.stringify(geoData);
        const rawCached = sessionStorage.getItem(this.CACHE_KEY_GEOJSON);
        if (rawNew !== rawCached) {
          this.setCachedItem(this.CACHE_KEY_GEOJSON, geoData);
          this.renderGeoJsonDistricts(geoData);
        }
      },
      error: (err) => {
        if (!cachedGeo) {
          console.error('Failed to load districts GeoJSON:', err);
        }
      },
    });
  }

  private schoolsLayer = L.layerGroup();
  private hospitalsLayer = L.layerGroup();

  private loadPoiLayer(type: 'school' | 'hospital'): void {
    if (!this.map) return;
    const targetLayer = type === 'school' ? this.schoolsLayer : this.hospitalsLayer;

    this.http.get<any[]>(`${this.API_BASE}/pois?type=${type}`).subscribe({
      next: (pois) => {
        targetLayer.clearLayers();
        pois.forEach((poi) => {
          const svgHtml =
            type === 'school'
              ? `<div class="poi-pin-badge poi-school" title="Escuela">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
                    <path d="M6 12v5c3 3 9 3 12 0v-5"/>
                  </svg>
                </div>`
              : `<div class="poi-pin-badge poi-hospital" title="Hospital">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 6v12M6 12h12"/>
                  </svg>
                </div>`;

          const icon = L.divIcon({
            html: svgHtml,
            className: 'poi-custom-container',
            iconSize: [26, 26],
            iconAnchor: [13, 13],
          });
          const marker = L.marker([poi.latitude, poi.longitude], { icon });
          marker.bindTooltip(poi.name ?? (type === 'school' ? 'Escuela' : 'Centro de Salud'), {
            direction: 'top',
            offset: [0, -10],
          });
          marker.addTo(targetLayer);
        });
      },
      error: (err) => {
        console.warn(`POI layer "${type}" not available:`, err.status ?? err.message);
      },
    });
  }

  private initMap(): void {
    const el = this.mapElement()?.nativeElement;
    if (!el) return;

    // Límite territorial con margen suficiente para vuelo y padding lateral
    const cercadoBounds = L.latLngBounds(L.latLng(-17.65, -66.4), L.latLng(-17.18, -65.9));

    this.map = L.map(el, {
      renderer: L.svg({ padding: 2.0 }),
      maxBounds: cercadoBounds,
      maxBoundsViscosity: 0.7, // Permite elasticidad para encuadrar distritos periféricos con drawer abierto
      minZoom: 10,
      maxZoom: 18,
      scrollWheelZoom: true, // Habilitado: zoom fluido con la rueda del ratón
      doubleClickZoom: true, // Doble clic para acercar
    }).setView([-17.406, -66.174], 12);

    // Canvas oscuro puro: permite apagar el mapa mundial y ver únicamente a Cercado
    const darkCanvas = L.layerGroup();

    const osmBase = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors | EcoUrba Cochabamba',
      maxZoom: 18,
      keepBuffer: 12,
      updateWhenIdle: false,
      updateWhenZooming: false,
    }).addTo(this.map);

    // Mapa Topográfico Real de Cochabamba (Esri World Topo: relieve real sin ruido)
    const esriTopo = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: '&copy; Esri, USGS, NOAA | Relieve Topográfico Oficial',
        maxZoom: 18,
      },
    );

    // Mapa de Curvas de Nivel y Montaña (OpenTopoMap)
    const openTopo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenTopoMap (CC-BY-SA) | Curvas de Nivel',
      maxZoom: 17,
    });

    // Capa oficial WMS del GAMC (Alcaldía de Cochabamba): Radio Urbano Homologado
    // Ficha técnica GAMC: El proxy municipal asigna la capa según service_id (LAYERS se envía vacío)
    const radioUrbanoGamcWms = L.tileLayer.wms(`${this.API_BASE}/gamc/wms`, {
      layers: '',
      format: 'image/png',
      transparent: true,
      version: '1.1.1',
      maxZoom: 19,
      opacity: 0.35,
      attribution: '&copy; GAMC · Límite del Radio Urbano Oficial',
    });

    // Real Cota 2750 Contour Line (Cargada dinámicamente vía GeoJSON oficial)
    const cota2750Line = L.geoJSON(undefined, {
      style: {
        color: '#dc2626',
        weight: 3,
        dashArray: '8, 6',
        opacity: 0.9,
      },
      onEachFeature: (feature, layer) => {
        layer.bindTooltip(
          `<strong>${feature.properties?.name || 'Línea Cota 2750 m.s.n.m.'}</strong><br>${feature.properties?.description || 'Límite ecológico y legal del Parque Nacional Tunari (Ley 1262)'}<br><small>Hacia el norte: área de conservación</small>`,
          { sticky: true },
        );
      },
    });

    fetch(`${this.API_BASE}/districts/cota2750`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          cota2750Line.addData(data);
        }
      })
      .catch((err) => console.warn('Error loading Cota 2750:', err));

    // Parques y Reservas Verdes de Cochabamba (Cargadas dinámicamente desde la API)
    const greenAreasLayer = L.layerGroup();
    const loadGreenPOIs = (type: string, color: string, radius: number) => {
      fetch(`${this.API_BASE}/pois?type=${type}`)
        .then((res) => (res.ok ? res.json() : []))
        .then((items: any[]) => {
          items.forEach((g) => {
            const lat = g.lat ?? g.latitude;
            const lng = g.lng ?? g.longitude;
            if (lat && lng) {
              const marker = L.circleMarker([lat, lng], {
                radius,
                fillColor: color,
                color: '#ffffff',
                weight: 2,
                fillOpacity: 0.95,
              });
              const typeLabel =
                g.sub_type || (type === 'green_area' ? 'Área Protegida' : 'Parque Urbano');
              const descLabel = g.description ? `<br><small>${g.description}</small>` : '';
              marker.bindTooltip(
                `<strong>${g.name}</strong><br><span style="color:#059669;font-weight:600">${typeLabel}</span>${descLabel}`,
                { direction: 'top', offset: [0, -6] },
              );
              marker.addTo(greenAreasLayer);
            }
          });
        })
        .catch((err) => console.warn(`Error loading POIs (${type}):`, err));
    };

    loadGreenPOIs('park', '#10b981', 7);
    loadGreenPOIs('green_area', '#059669', 8);

    // Rásters Satelitales Oficiales de la NASA (842 x 1032 px georreferenciados)
    const defaultRasterBounds: L.LatLngBoundsExpression = [
      [-17.547539808818485, -66.29457894571759],
      [-17.264661664569346, -66.05274190721205],
    ];
    const hotspotRasterBounds: L.LatLngBoundsExpression = [
      [-17.535737717665434, -66.28312707797097],
      [-17.276771630866786, -66.06619722598597],
    ];

    const lst2025Raster = L.imageOverlay(
      `${this.API_BASE}/rasters/lst_2025.png`,
      defaultRasterBounds,
      { opacity: 0.82, interactive: false }
    );
    const ndvi2025Raster = L.imageOverlay(
      `${this.API_BASE}/rasters/ndvi_2025.png`,
      defaultRasterBounds,
      { opacity: 0.82, interactive: false }
    );
    const deltaLstRaster = L.imageOverlay(
      `${this.API_BASE}/rasters/delta_lst.png`,
      defaultRasterBounds,
      { opacity: 0.85, interactive: false }
    );
    const deltaNdviRaster = L.imageOverlay(
      `${this.API_BASE}/rasters/delta_ndvi.png`,
      defaultRasterBounds,
      { opacity: 0.85, interactive: false }
    );
    const hotspotsRaster = L.imageOverlay(
      `${this.API_BASE}/rasters/hotspots_2024.png`,
      hotspotRasterBounds,
      { opacity: 0.9, interactive: false }
    );

    this.districtLayer = L.layerGroup().addTo(this.map);

    L.control
      .layers(
        {
          'OpenStreetMap (Urbano Limpio)': osmBase,
          'Relieve y Topografía Real (Esri Topo)': esriTopo,
          'Curvas de Nivel (OpenTopoMap)': openTopo,
          'Solo Cercado (Fondo Limpio)': darkCanvas,
        },
        {
          'Puntos de Inversión Sugeridos (Flaticons)': this.interventionsLayer,
          'Cobertura Forestal y Parques': greenAreasLayer,
          Escuelas: this.schoolsLayer,
          Hospitales: this.hospitalsLayer,
          'Límite Radio Urbano (GAMC Oficial)': radioUrbanoGamcWms,
          'Cota 2750 Parque Tunari': cota2750Line,
          'Distritos y Estaciones MÓNICA': this.districtLayer,
          'NASA Térmico Píxel a Píxel (LST 2025)': lst2025Raster,
          'NASA Vegetación Píxel a Píxel (NDVI 2025)': ndvi2025Raster,
          'NASA Hotspots Térmicos 2024': hotspotsRaster,
          'Cambio Térmico 2016 - 2025 (Delta LST)': deltaLstRaster,
          'Cambio Vegetal 2016 - 2025 (Delta NDVI)': deltaNdviRaster,
        },
        { position: 'topright', collapsed: true }
      )
      .addTo(this.map);

    this.schoolsLayer.addTo(this.map);
    this.hospitalsLayer.addTo(this.map);
    greenAreasLayer.addTo(this.map);
    this.interventionsLayer.addTo(this.map);

    if (this.districts().length > 0) {
      this.renderDistrictsOnMap(this.districts());
      this.loadDistrictsGeoJson();
    }

    this.loadPoiLayer('school');
    this.loadPoiLayer('hospital');

    this.map.on('zoom', () => {
      this.updateZoomState();
    });

    this.map.on('zoomend', () => {
      this.updateZoomState();
    });

    this.updateZoomState();
  }

  private renderGeoJsonDistricts(geoData: any): void {
    if (!this.map) return;

    if (this.geoJsonLayer) {
      this.map.removeLayer(this.geoJsonLayer);
      this.polygonMap.clear();
    }

    const svgRenderer = L.svg({ padding: 2.0 });

    this.geoJsonLayer = L.geoJSON(geoData, {
      style: (feature) => {
        const fillColor = this.getFillColorForFeature(feature?.properties);
        const zoom = this.map?.getZoom() ?? 12;
        const fillOpacity = this.getDynamicFillOpacity(zoom, false);
        return {
          ...this.defaultPolygonStyle,
          renderer: svgRenderer,
          fillColor,
          fillOpacity,
          weight: 1.5,
        };
      },
      onEachFeature: (feature, layer) => {
        const props = feature.properties || {};
        const districtId = Number(props.id);
        const pathLayer = layer as L.Path;

        this.polygonMap.set(districtId, pathLayer);

        // Permanent district number label
        (layer as L.Layer & { bindTooltip: Function }).bindTooltip(String(districtId), {
          permanent: true,
          direction: 'center',
          className: 'district-number-label',
        });

        const sensorText = props.has_fixed_sensor
          ? `<br><span style="color:#059669;font-weight:600">Sensor MÓNICA: ${props.station_name}</span>`
          : '<br><span style="color:#71717a;font-style:italic">Sensado Virtual</span>';

        const areaText = props.area_km2
          ? `<br>Superficie: <strong>${Number(props.area_km2).toFixed(2)} km²</strong>`
          : '';

        layer.bindPopup(
          `<strong>${props.name}</strong><br><span style="color:#71717a">${props.zone}</span>${areaText}${sensorText}`,
        );

        layer.on('mouseover', () => {
          if (this.activePolygon !== pathLayer) {
            const zoom = this.map?.getZoom() ?? 12;
            const baseOpacity = this.getDynamicFillOpacity(zoom, false);
            pathLayer.setStyle({ weight: 2.5, fillOpacity: Math.min(0.65, baseOpacity + 0.15) });
            pathLayer.bringToFront();
          }
        });

        layer.on('mouseout', () => {
          if (this.activePolygon !== pathLayer) {
            const fillColor = this.getFillColorForFeature(props);
            const zoom = this.map?.getZoom() ?? 12;
            const baseOpacity = this.getDynamicFillOpacity(zoom, false);
            pathLayer.setStyle({
              ...this.defaultPolygonStyle,
              fillColor,
              fillOpacity: baseOpacity,
              weight: 1.5,
            });
          }
        });

        layer.on('click', () => {
          const found = this.districts().find((d) => d.id === districtId);
          if (found) {
            this.selectDistrict(found);
          }
        });
      },
    }).addTo(this.map);

    // Re-highlight selected district if one is already active, else initial fitBounds
    const selected = this.selectedDistrict();
    if (selected) {
      const activePoly = this.polygonMap.get(selected.id);
      if (activePoly) {
        const fill = this.getFillColorForFeature((activePoly as any).feature?.properties);
        activePoly.setStyle({ ...this.selectedPolygonStyle, fillColor: fill });
        this.activePolygon = activePoly;
        activePoly.bringToFront();
        const elem = (activePoly as any).getElement?.();
        elem?.classList.add('district-selected');
      }
    } else {
      // Encuadre inicial estricto sobre los 15 distritos de Cercado
      this.map.fitBounds(this.geoJsonLayer.getBounds(), {
        padding: [20, 20],
      });
    }

    // Bring markers to front so centroids stay clickable
    this.districtLayer?.eachLayer((l: any) => l.bringToFront?.());
  }

  private renderDistrictsOnMap(districts: District[]): void {
    if (!this.map || !this.districtLayer) return;

    this.districtLayer.clearLayers();

    districts.forEach((d) => {
      const isSensor = d.has_fixed_sensor;

      const marker = L.circleMarker([d.centroid.latitude, d.centroid.longitude], {
        radius: isSensor ? 9 : 6,
        fillColor: isSensor ? '#10b981' : '#6366f1',
        color: '#ffffff',
        weight: 2,
        fillOpacity: 0.9,
      });

      const tooltipContent = isSensor
        ? `<strong>Estación Red MÓNICA</strong><br>${d.station_name}<br><span style="color:#71717a">${d.name} (${d.zone})</span>`
        : `<strong>${d.name}</strong><br><span style="color:#71717a">${d.zone}</span>`;

      marker.bindTooltip(tooltipContent, {
        direction: 'top',
        offset: [0, -6],
      });

      marker.on('click', () => this.selectDistrict(d));
      marker.addTo(this.districtLayer!);
    });
  }

  selectDistrict(district: District): void {
    if (!this.map) return;
    if (this.selectedDistrict()?.id === district.id) return;

    // Cancela cualquier animación previa inmediatamente para evitar tirones o carreras
    this.map.stop();
    this.map.closePopup();

    // Cancela cualquier petición HTTP de sugerencia en vuelo
    this.suggestionSub?.unsubscribe();

    this.selectedDistrict.set(district);
    this.rightDrawerOpen.set(true);
    this.sidebarCollapsed.set(true); // Garantiza UN SOLO sidebar activo para evitar saturar el mapa

    // Reset previous active polygon style & remove selected class
    if (this.activePolygon) {
      const prevElem = (this.activePolygon as any).getElement?.();
      prevElem?.classList.remove('district-selected');
      const prevProps = (this.activePolygon as any).feature?.properties;
      const prevFillColor = this.getFillColorForFeature(prevProps);
      const zoom = this.map.getZoom();
      const prevOpacity = this.getDynamicFillOpacity(zoom, false);
      this.activePolygon.setStyle({
        ...this.defaultPolygonStyle,
        fillColor: prevFillColor,
        fillOpacity: prevOpacity,
        weight: 1.5,
      });
    }

    const poly = this.polygonMap.get(district.id);
    if (poly) {
      const currentFill = this.getFillColorForFeature((poly as any).feature?.properties);
      const zoom = this.map.getZoom();
      const selOpacity = this.getDynamicFillOpacity(zoom, true);
      poly.setStyle({
        ...this.selectedPolygonStyle,
        fillColor: currentFill,
        fillOpacity: selOpacity,
      });
      this.activePolygon = poly;

      // Bring selected polygon to front so glow & border are prominent
      poly.bringToFront();

      const elem = (poly as any).getElement?.();
      elem?.classList.add('district-selected');

      const bounds = (poly as any).getBounds?.();
      if (bounds) {
        // Transición de vuelo cinemática con margen para el drawer derecho
        this.map.flyToBounds(bounds, {
          paddingTopLeft: [40, 40],
          paddingBottomRight: [430, 40],
          maxZoom: 14,
          duration: 0.85,
          easeLinearity: 0.25,
        });
      } else {
        this.map.flyTo([district.centroid.latitude, district.centroid.longitude], 13.5, {
          duration: 0.85,
          easeLinearity: 0.25,
        });
      }
    } else {
      this.map.flyTo([district.centroid.latitude, district.centroid.longitude], 14, {
        duration: 0.85,
        easeLinearity: 0.25,
      });
    }

    // Resetea sugerencias previas al cambiar de distrito para no saturar el mapa
    this.suggestion.set(null);
    this.suggestionLoading.set(false);
    this.interventionsLayer.clearLayers();

    // Fetch NASA Trend Detective analysis
    this.trendLoading.set(true);
    this.trendSub = this.http
      .get<TrendAnalysisResult>(`${this.API_BASE}/districts/${district.id}/trends`)
      .subscribe({
        next: (res) => {
          this.districtTrend.set(res);
          this.trendLoading.set(false);
        },
        error: () => {
          this.districtTrend.set(null);
          this.trendLoading.set(false);
        },
      });
  }

  generateSuggestions(force = false): void {
    const district = this.selectedDistrict();
    if (!district) return;
    this.suggestionLoading.set(true);
    this.suggestionSub?.unsubscribe();
    const url = force
      ? `${this.API_BASE}/districts/${district.id}/suggestion?force_refresh=true`
      : `${this.API_BASE}/districts/${district.id}/suggestion`;
    this.suggestionSub = this.http
      .get<SuggestionResult>(url)
      .subscribe({
        next: (result) => {
          this.suggestion.set(result);
          this.suggestionLoading.set(false);
          if (result.candidate_interventions && result.candidate_interventions.length > 0) {
            this.renderInterventions(result.candidate_interventions);
          }
        },
        error: () => {
          this.suggestion.set(null);
          this.suggestionLoading.set(false);
          this.interventionsLayer.clearLayers();
        },
      });
  }

  clearInterventions(): void {
    this.suggestion.set(null);
    this.suggestionLoading.set(false);
    this.interventionsLayer.clearLayers();
  }

  @HostListener('window:keydown', ['$event'])
  handleEscapeKey(event: KeyboardEvent): void {
    if (event.key === 'Escape' || event.key === 'Esc' || event.keyCode === 27) {
      if (this.selectedDistrict()) {
        event.preventDefault();
        event.stopPropagation();
        this.clearSelection();
      }
    }
  }

  clearSelection(): void {
    if (!this.selectedDistrict()) return;
    if (this.map) {
      this.map.stop();
      this.map.closePopup();
    }
    this.suggestionSub?.unsubscribe();
    this.trendSub?.unsubscribe();

    this.selectedDistrict.set(null);
    this.rightDrawerOpen.set(false);
    this.suggestion.set(null);
    this.suggestionLoading.set(false);
    this.districtTrend.set(null);
    this.trendLoading.set(false);
    this.interventionsLayer.clearLayers();

    if (this.activePolygon) {
      const prevElem = (this.activePolygon as any).getElement?.();
      prevElem?.classList.remove('district-selected');
      const prevProps = (this.activePolygon as any).feature?.properties;
      const prevFillColor = this.getFillColorForFeature(prevProps);
      const zoom = this.map?.getZoom() ?? 12;
      const baseOpacity = this.getDynamicFillOpacity(zoom, false);
      this.activePolygon.setStyle({
        ...this.defaultPolygonStyle,
        fillColor: prevFillColor,
        fillOpacity: baseOpacity,
        weight: 1.5,
      });
      this.activePolygon = undefined;
    }
    if (this.geoJsonLayer && this.map) {
      this.map.flyToBounds(this.geoJsonLayer.getBounds(), {
        padding: [30, 30],
        duration: 0.75,
        easeLinearity: 0.25,
      });
    }
  }

  private renderInterventions(interventions: InterventionPoint[]): void {
    if (!this.map) return;
    this.interventionsLayer.clearLayers();

    interventions.forEach((item) => {
      let iconClass = 'pulse-tree-badge';
      let svgIcon = '';
      let badgeLabel = 'Reforestación';

      if (item.type === 'tree_planting') {
        iconClass = 'pulse-tree-badge';
        badgeLabel = 'Arbolado Urbano';
        svgIcon = `
          <div class="intervention-marker ${iconClass}" title="${item.title}">
            <div class="pulse-ring green"></div>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 19V6"/>
              <path d="M8 19V11"/>
              <path d="M16 19V11"/>
              <path d="M12 2a5 5 0 0 0-5 5c0 2 1.5 3.5 3 4.5V19h4v-7.5c1.5-1 3-2.5 3-4.5a5 5 0 0 0-5-5z"/>
            </svg>
          </div>
        `;
      } else if (item.type === 'health_center') {
        iconClass = 'pulse-health-badge';
        badgeLabel = 'Centro de Salud';
        svgIcon = `
          <div class="intervention-marker ${iconClass}" title="${item.title}">
            <div class="pulse-ring red"></div>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 6v12M6 12h12"/>
              <rect width="18" height="18" x="3" y="3" rx="4"/>
            </svg>
          </div>
        `;
      } else {
        iconClass = 'pulse-park-badge';
        badgeLabel = 'Parque de Quebrada';
        svgIcon = `
          <div class="intervention-marker ${iconClass}" title="${item.title}">
            <div class="pulse-ring cyan"></div>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/>
              <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
            </svg>
          </div>
        `;
      }

      const icon = L.divIcon({
        html: svgIcon,
        className: 'intervention-div-icon',
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      const marker = L.marker([item.latitude, item.longitude], { icon });

      const popupHtml = `
        <div class="intervention-popup-box">
          <div class="popup-header">
            <span class="popup-tag ${item.type}">${badgeLabel}</span>
            <span class="popup-prio">${item.priority}</span>
          </div>
          <h4>${item.title}</h4>
          <div class="popup-metrics">
            <div class="metric-row">
              <span class="m-label">Pendiente (NASA SRTM):</span>
              <span class="m-val ${item.slope_pct > 15 ? 'steep' : 'flat'}">${item.slope_pct}% ${item.slope_pct > 15 ? '(Ladera)' : '(Planicie)'}</span>
            </div>
            <div class="metric-row">
              <span class="m-label">Elevación:</span>
              <span class="m-val">${item.elevation_m} m s.n.m.</span>
            </div>
            <div class="metric-row">
              <span class="m-label">Isla de Calor:</span>
              <span class="m-val">${item.heat_risk}</span>
            </div>
          </div>
          <p class="popup-reason">${item.reason}</p>
        </div>
      `;

      marker.bindPopup(popupHtml, { maxWidth: 300 });
      marker.bindTooltip(
        `<strong>${item.title}</strong><br><small>Pendiente: ${item.slope_pct}% · Click para ver diagnóstico</small>`,
        { direction: 'top', offset: [0, -18] },
      );

      marker.addTo(this.interventionsLayer);
    });
  }

  toggleComparator(): void {
    const nextState = !this.showComparator();
    this.showComparator.set(nextState);
    if (nextState) {
      setTimeout(() => {
        this.initComparatorSplitMaps();
      }, 30);
    } else {
      setTimeout(() => {
        this.map?.invalidateSize();
      }, 50);
    }
  }

  setComparatorVariable(v: 'ndvi' | 'lst'): void {
    this.comparatorVariable.set(v);
    this.updateSplitRasterLayers();
  }

  setComparatorMode(m: 'dual' | 'delta'): void {
    this.comparatorMode.set(m);
    this.updateSplitRasterLayers();
    setTimeout(() => {
      this.mapA?.invalidateSize();
      if (m === 'dual') {
        this.mapB?.invalidateSize();
      }
    }, 50);
  }

  setComparatorYearA(y: number): void {
    this.comparatorYearA.set(y);
    this.updateSplitRasterLayers();
  }

  setComparatorYearB(y: number): void {
    this.comparatorYearB.set(y);
    this.updateSplitRasterLayers();
  }

  onOpacityChange(event: Event): void {
    const val = Number((event.target as HTMLInputElement).value) / 100;
    this.comparatorOpacity.set(val);
    if (this.layerA) this.layerA.setOpacity(val);
    if (this.layerB) this.layerB.setOpacity(val);
  }

  private initComparatorSplitMaps(): void {
    const elA = this.mapAElement()?.nativeElement;
    const elB = this.mapBElement()?.nativeElement;
    if (!elA || !elB) return;

    const bounds: L.LatLngBoundsExpression = [
      [-17.547539808818485, -66.29457894571759],
      [-17.264661664569346, -66.05274190721205],
    ];

    if (!this.mapA) {
      this.mapA = L.map(elA, {
        zoomControl: true,
        attributionControl: false,
        zoomSnap: 0.25,
        zoomDelta: 0.5,
      });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(this.mapA);
      this.mapA.fitBounds(bounds, { padding: [14, 14] });
      this.addDistrictBoundariesToMap(this.mapA);
    }

    if (!this.mapB) {
      this.mapB = L.map(elB, {
        zoomControl: false,
        attributionControl: false,
        zoomSnap: 0.25,
        zoomDelta: 0.5,
      });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(this.mapB);
      this.mapB.fitBounds(bounds, { padding: [14, 14] });
      this.addDistrictBoundariesToMap(this.mapB);
    }

    // Bidirectional Map Sync (Pan & Zoom)
    if (this.syncCleanup.length === 0 && this.mapA && this.mapB) {
      let syncing = false;
      const sync = (source: L.Map, target: L.Map) => {
        const handler = () => {
          if (syncing) return;
          syncing = true;
          target.setView(source.getCenter(), source.getZoom(), { animate: false });
          syncing = false;
        };
        source.on('move', handler);
        return () => source.off('move', handler);
      };

      this.syncCleanup.push(sync(this.mapA, this.mapB));
      this.syncCleanup.push(sync(this.mapB, this.mapA));
    }

    this.updateSplitRasterLayers();

    setTimeout(() => {
      this.mapA?.invalidateSize();
      this.mapB?.invalidateSize();
    }, 50);
  }

  private addDistrictBoundariesToMap(targetMap: L.Map): void {
    const geo = this.cachedGeoData || this.getCachedItem<any>(this.CACHE_KEY_GEOJSON);
    if (!geo) return;
    L.geoJSON(geo, {
      style: {
        color: '#ffffff',
        weight: 1.5,
        fillOpacity: 0,
        opacity: 0.75,
      },
      onEachFeature: (feature, layer) => {
        const name = feature.properties?.Distrito || feature.properties?.nombre || `D${feature.properties?.id ?? ''}`;
        layer.bindTooltip(name, {
          direction: 'center',
          className: 'district-tooltip-label',
        });
      },
    }).addTo(targetMap);
  }

  private updateSplitRasterLayers(): void {
    const bounds: L.LatLngBoundsExpression = [
      [-17.547539808818485, -66.29457894571759],
      [-17.264661664569346, -66.05274190721205],
    ];
    const opacity = this.comparatorOpacity();
    const v = this.comparatorVariable();
    const mode = this.comparatorMode();

    if (this.layerA && this.mapA) {
      this.mapA.removeLayer(this.layerA);
      this.layerA = undefined;
    }
    if (this.layerB && this.mapB) {
      this.mapB.removeLayer(this.layerB);
      this.layerB = undefined;
    }

    if (mode === 'delta') {
      const key = `delta_${v}`;
      if (this.mapA) {
        this.layerA = L.imageOverlay(`${this.API_BASE}/rasters/${key}.png`, bounds, {
          opacity,
          interactive: false,
        }).addTo(this.mapA);
      }
    } else {
      const keyA = `${v}_${this.comparatorYearA()}`;
      const keyB = `${v}_${this.comparatorYearB()}`;

      if (this.mapA) {
        this.layerA = L.imageOverlay(`${this.API_BASE}/rasters/${keyA}.png`, bounds, {
          opacity,
          interactive: false,
        }).addTo(this.mapA);
      }
      if (this.mapB) {
        this.layerB = L.imageOverlay(`${this.API_BASE}/rasters/${keyB}.png`, bounds, {
          opacity,
          interactive: false,
        }).addTo(this.mapB);
      }
    }
  }
}
