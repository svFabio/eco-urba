import {
  Component,
  OnInit,
  AfterViewInit,
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
export class App implements OnInit, AfterViewInit {
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

  top5Districts = computed(() =>
    [...this.districts()]
      .sort((a, b) => {
        const aVal = a.tree_canopy_pct ?? a.microclimate?.tree_canopy_pct ?? 0;
        const bVal = b.tree_canopy_pct ?? b.microclimate?.tree_canopy_pct ?? 0;
        return bVal - aVal;
      })
      .slice(0, 5)
  );

  private readonly API_BASE = (() => {
    if (typeof window !== 'undefined') {
      const customApi = (window as unknown as { __API_BASE__?: string }).__API_BASE__;
      if (customApi) {
        return customApi;
      }
      const host = window.location.hostname;
      if (host === 'localhost' || host === '127.0.0.1') {
        return 'http://localhost:8000/api/v1';
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
    const risk = (props?.heat_island_risk || props?.microclimate?.heat_island_risk) as string | undefined;
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

  private updatePolygonColors(): void {
    if (!this.geoJsonLayer) return;
    this.geoJsonLayer.eachLayer((layer: any) => {
      const props = layer.feature?.properties || {};
      const fillColor = this.getFillColorForFeature(props);
      if (this.activePolygon === layer) {
        layer.setStyle({ ...this.selectedPolygonStyle, fillColor });
      } else {
        layer.setStyle({ ...this.defaultPolygonStyle, fillColor, fillOpacity: 0.5 });
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
    color: '#09090b',
    weight: 3.5,
    opacity: 1,
    fillOpacity: 0.6,
  };

  ngOnInit(): void {
    this.checkHealth();
    this.loadDistricts();
  }

  ngAfterViewInit(): void {
    this.initMap();
  }

  private checkHealth(): void {
    this.http.get<{ status: string }>(`${this.API_BASE}/health`).subscribe({
      next: (res) => this.backendHealthy.set(res.status === 'healthy'),
      error: () => this.backendHealthy.set(false),
    });
  }

  private loadDistricts(): void {
    this.http.get<District[]>(`${this.API_BASE}/districts`).subscribe({
      next: (data) => {
        this.districts.set(data);
        this.isLoading.set(false);
        this.renderDistrictsOnMap(data);
        this.loadDistrictsGeoJson();
      },
      error: (err) => {
        console.error('Failed to load districts from backend:', err);
        this.isLoading.set(false);
      },
    });
  }

  private loadDistrictsGeoJson(): void {
    if (!this.map) return;

    this.http.get<any>(`${this.API_BASE}/districts/geojson`).subscribe({
      next: (geoData) => {
        this.renderGeoJsonDistricts(geoData);
      },
      error: (err) => {
        console.error('Failed to load districts GeoJSON:', err);
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

    // Límite territorial estricto para Cercado (Cochabamba)
    const cercadoBounds = L.latLngBounds(
      L.latLng(-17.56, -66.32),
      L.latLng(-17.25, -66.03)
    );

    this.map = L.map(el, {
      maxBounds: cercadoBounds,
      maxBoundsViscosity: 1.0, // Bloqueo rígido: no permite arrastrar el mapa fuera de Cercado
      minZoom: 11,            // No permite alejarse hacia el resto de Bolivia o el mundo
      maxZoom: 18,
      scrollWheelZoom: false, // Mapa tranquilo: evita zoom descontrolado al hacer scroll
      doubleClickZoom: false, // Zoom controlado por clics en distritos
    }).setView([-17.406, -66.174], 12);

    // Canvas oscuro puro: permite apagar el mapa mundial y ver únicamente a Cercado
    const darkCanvas = L.layerGroup();

    const osmBase = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors | EcoUrba Cochabamba',
      maxZoom: 18,
    }).addTo(this.map);

    // Mapa Topográfico Real de Cochabamba (Esri World Topo: relieve real sin ruido)
    const esriTopo = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: '&copy; Esri, USGS, NOAA | Relieve Topográfico Oficial',
        maxZoom: 18,
      }
    );

    // Mapa de Curvas de Nivel y Montaña (OpenTopoMap)
    const openTopo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenTopoMap (CC-BY-SA) | Curvas de Nivel',
      maxZoom: 17,
    });

    // Capas oficiales del GAMC (Alcaldía de Cochabamba)
    const cuencasGamcWms = L.tileLayer.wms(`${this.API_BASE}/gamc/wms`, {
      layers: 'cuencas_principales',
      format: 'image/png',
      transparent: true,
      version: '1.1.1',
      maxZoom: 19,
      opacity: 0.7,
      attribution: '&copy; GAMC · Cuencas Principales',
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
          { sticky: true }
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
              const typeLabel = g.sub_type || (type === 'green_area' ? 'Área Protegida' : 'Parque Urbano');
              const descLabel = g.description ? `<br><small>${g.description}</small>` : '';
              marker.bindTooltip(
                `<strong>${g.name}</strong><br><span style="color:#059669;font-weight:600">${typeLabel}</span>${descLabel}`,
                { direction: 'top', offset: [0, -6] }
              );
              marker.addTo(greenAreasLayer);
            }
          });
        })
        .catch((err) => console.warn(`Error loading POIs (${type}):`, err));
    };

    loadGreenPOIs('park', '#10b981', 7);
    loadGreenPOIs('green_area', '#059669', 8);

    this.districtLayer = L.layerGroup().addTo(this.map);

    L.control.layers(
      {
        'OpenStreetMap (Urbano Limpio)': osmBase,
        'Relieve y Topografía Real (Esri Topo)': esriTopo,
        'Curvas de Nivel (OpenTopoMap)': openTopo,
        'Solo Cercado (Fondo Limpio)': darkCanvas,
      },
      {
        'Puntos de Inversión Sugeridos (Flaticons)': this.interventionsLayer,
        'Cobertura Forestal y Parques': greenAreasLayer,
        'Escuelas': this.schoolsLayer,
        'Hospitales': this.hospitalsLayer,
        'Cuencas y Torrentes Tunari (GAMC)': cuencasGamcWms,
        'Cota 2750 Parque Tunari': cota2750Line,
        'Distritos y Estaciones MÓNICA': this.districtLayer,
      },
      { position: 'topright', collapsed: false }
    ).addTo(this.map);

    this.schoolsLayer.addTo(this.map);
    this.hospitalsLayer.addTo(this.map);
    greenAreasLayer.addTo(this.map);
    this.interventionsLayer.addTo(this.map);

    if (this.districts().length > 0) {
      this.loadDistrictsGeoJson();
    }

    this.loadPoiLayer('school');
    this.loadPoiLayer('hospital');

    this.map.on('zoomend', () => {
      const z = this.map!.getZoom();
      this.currentZoom.set(z);
    });
  }

  private renderGeoJsonDistricts(geoData: any): void {
    if (!this.map) return;

    if (this.geoJsonLayer) {
      this.map.removeLayer(this.geoJsonLayer);
      this.polygonMap.clear();
    }

    this.geoJsonLayer = L.geoJSON(geoData, {
      style: (feature) => {
        const fillColor = this.getFillColorForFeature(feature?.properties);
        return {
          ...this.defaultPolygonStyle,
          fillColor,
          fillOpacity: 0.5,
          weight: 1.5,
        };
      },
      onEachFeature: (feature, layer) => {
        const props = feature.properties || {};
        const districtId = Number(props.id);
        const pathLayer = layer as L.Path;

        this.polygonMap.set(districtId, pathLayer);

        // Permanent district number label
        (layer as L.Layer & { bindTooltip: Function }).bindTooltip(
          String(districtId),
          {
            permanent: true,
            direction: 'center',
            className: 'district-number-label',
          }
        );

        const sensorText = props.has_fixed_sensor
          ? `<br><span style="color:#059669;font-weight:600">Sensor MÓNICA: ${props.station_name}</span>`
          : '<br><span style="color:#71717a;font-style:italic">Sensado Virtual</span>';

        const areaText = props.area_km2
          ? `<br>Superficie: <strong>${Number(props.area_km2).toFixed(2)} km²</strong>`
          : '';

        layer.bindPopup(
          `<strong>${props.name}</strong><br><span style="color:#71717a">${props.zone}</span>${areaText}${sensorText}`
        );

        layer.on('mouseover', () => {
          if (this.activePolygon !== pathLayer) {
            pathLayer.setStyle({ weight: 3, fillOpacity: 0.75 });
            pathLayer.bringToFront();
          }
        });

        layer.on('mouseout', () => {
          if (this.activePolygon !== pathLayer) {
            const fillColor = this.getFillColorForFeature(props);
            pathLayer.setStyle({ ...this.defaultPolygonStyle, fillColor, fillOpacity: 0.5, weight: 1.5 });
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

    // Encuadre inicial estricto sobre los 15 distritos de Cercado
    this.map.fitBounds(this.geoJsonLayer.getBounds(), {
      padding: [20, 20],
    });

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

    // Cancela cualquier petición HTTP de sugerencia en vuelo
    this.suggestionSub?.unsubscribe();

    this.selectedDistrict.set(district);

    // Reset previous active polygon style & remove selected class
    if (this.activePolygon) {
      const prevElem = (this.activePolygon as any).getElement?.();
      prevElem?.classList.remove('district-selected');
      const prevProps = (this.activePolygon as any).feature?.properties;
      const prevFillColor = this.getFillColorForFeature(prevProps);
      this.activePolygon.setStyle({
        ...this.defaultPolygonStyle,
        fillColor: prevFillColor,
        fillOpacity: 0.5,
        weight: 1.5,
      });
    }

    const poly = this.polygonMap.get(district.id);
    if (poly) {
      const currentFill = this.getFillColorForFeature((poly as any).feature?.properties);
      poly.setStyle({ ...this.selectedPolygonStyle, fillColor: currentFill });
      this.activePolygon = poly;

      const elem = (poly as any).getElement?.();
      elem?.classList.add('district-selected');

      const bounds = (poly as any).getBounds?.();
      if (bounds) {
        // Transición suave, rápida y precisa sin salto parabólico brusco
        this.map.fitBounds(bounds, {
          paddingTopLeft: [30, 30],
          paddingBottomRight: [430, 30],
          maxZoom: 15,
          animate: true,
          duration: 0.35,
        });
      } else {
        this.map.panTo([district.centroid.latitude, district.centroid.longitude], {
          animate: true,
          duration: 0.35,
        });
      }
    } else {
      this.map.panTo([district.centroid.latitude, district.centroid.longitude], {
        animate: true,
        duration: 0.35,
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

  generateSuggestions(): void {
    const district = this.selectedDistrict();
    if (!district) return;
    this.suggestionLoading.set(true);
    this.suggestionSub?.unsubscribe();
    this.suggestionSub = this.http
      .get<SuggestionResult>(`${this.API_BASE}/districts/${district.id}/suggestion`)
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

  clearSelection(): void {
    if (!this.selectedDistrict()) return;
    if (this.map) {
      this.map.stop();
    }
    this.suggestionSub?.unsubscribe();
    this.trendSub?.unsubscribe();

    this.selectedDistrict.set(null);
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
      this.activePolygon.setStyle({
        ...this.defaultPolygonStyle,
        fillColor: prevFillColor,
        fillOpacity: 0.5,
        weight: 1.5,
      });
      this.activePolygon = undefined;
    }
    if (this.geoJsonLayer && this.map) {
      this.map.fitBounds(this.geoJsonLayer.getBounds(), {
        padding: [20, 20],
        animate: true,
        duration: 0.35,
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
        { direction: 'top', offset: [0, -18] }
      );

      marker.addTo(this.interventionsLayer);
    });
  }
}
