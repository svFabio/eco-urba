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
import * as L from 'leaflet';

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

export interface SuggestionResult {
  meets_goal: boolean;
  tree_canopy_pct: number;
  suggestion_text: string;
  available_areas_hint: string;
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

  districts = signal<District[]>([]);
  selectedDistrict = signal<District | null>(null);
  isLoading = signal<boolean>(true);
  backendHealthy = signal<boolean>(false);
  suggestion = signal<SuggestionResult | null>(null);
  suggestionLoading = signal(false);
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

  private readonly API_BASE = 'http://localhost:8000/api/v1';

  private readonly defaultPolygonStyle: L.PathOptions = {
    color: '#ffffff',
    weight: 1.5,
    opacity: 0.9,
    fillColor: '#94a3b8',
    fillOpacity: 0.45,
  };

  getDistrictColor(risk: string): string {
    switch (risk) {
      case 'Bajo': return '#4caf50';
      case 'Moderado': return '#ffeb3b';
      case 'Alto': return '#ff9800';
      case 'Crítico': return '#f44336';
      default: return '#8b5cf6';
    }
  }

  getFillColorForFeature(props: any): string {
    const metric = this.activeMetric();
    const risk = (props?.heat_island_risk || props?.microclimate?.heat_island_risk) as string | undefined;
    const canopy = props?.tree_canopy_pct ?? props?.microclimate?.tree_canopy_pct ?? 0;

    if (metric === 'vegetation') {
      if (canopy >= 30) return '#15803d';
      if (canopy >= 20) return '#22c55e';
      if (canopy >= 15) return '#84cc16';
      if (canopy >= 10) return '#eab308';
      return '#f97316';
    }

    if (metric === 'goal') {
      return canopy >= 44 ? '#16a34a' : '#f43f5e';
    }

    return risk ? this.getDistrictColor(risk) : '#94a3b8';
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

    // GAMC WMS tilelayer kept optional in layer controls so it does not hide vector borders
    const distritosGamcWms = L.tileLayer.wms(`${this.API_BASE}/gamc/wms`, {
      layers: '',
      format: 'image/png',
      transparent: true,
      version: '1.1.1',
      maxZoom: 19,
      attribution: '&copy; GAMC Cochabamba · Limite Distritos Simple',
    });

    // Real Cota 2750 Contour Line (Northern Conservation Boundary - Parque Tunari)
    const cota2750Coords: [number, number][] = [
      [-17.352, -66.218],
      [-17.350, -66.205],
      [-17.347, -66.192],
      [-17.344, -66.178],
      [-17.341, -66.165],
      [-17.339, -66.152],
      [-17.341, -66.140],
      [-17.346, -66.128],
      [-17.351, -66.115],
      [-17.356, -66.102],
    ];

    const cota2750Line = L.polyline(cota2750Coords, {
      color: '#dc2626',
      weight: 3,
      dashArray: '8, 6',
      opacity: 0.9,
    });
    cota2750Line.bindTooltip(
      '<strong>Línea Cota 2750 m.s.n.m.</strong><br>Límite ecológico y legal del Parque Nacional Tunari (Ley 1262)<br><small>Hacia el norte: área de conservación</small>',
      { sticky: true }
    );

    // Capa Satelital NASA GIBS: Índice de Vegetación (NDVI) MODIS Terra (1km)
    const nasaNdviLayer = L.tileLayer.wms('https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi', {
      layers: 'MODIS_Terra_L3_NDVI_Monthly',
      format: 'image/png',
      transparent: true,
      version: '1.1.1',
      opacity: 0.35,
      attribution: '&copy; NASA EOSDIS GIBS · MODIS Terra NDVI',
    });

    // Parques y Reservas Verdes emblemáticas de Cochabamba (Vectorial)
    const greenAreasLayer = L.layerGroup();
    const urbanGreenSpaces = [
      {
        name: 'Parque Nacional Tunari (Área Protegida)',
        desc: 'Pulmón verde principal de Cochabamba, zona de recarga hídrica sobre la Cota 2750.',
        lat: -17.3380,
        lon: -66.1650,
        type: 'Reserva Forestal',
      },
      {
        name: 'Jardín Botánico Martín Cárdenas',
        desc: 'Reserva de flora nativa y biodiversidad andina (Distrito 12).',
        lat: -17.3712,
        lon: -66.1486,
        type: 'Jardín Botánico',
      },
      {
        name: 'Laguna Alalay (Humedal y Anillo Verde)',
        desc: 'Humedal urbano y franja de mitigación microclimática (Distritos 5 y 6).',
        lat: -17.4170,
        lon: -66.1360,
        type: 'Humedal y Cinturón Verde',
      },
      {
        name: 'Parque de la Familia',
        desc: 'Espacio verde y recreativo urbano con circuito de aguas.',
        lat: -17.3872,
        lon: -66.1601,
        type: 'Parque Urbano',
      },
      {
        name: 'Parque del Bicentenario',
        desc: 'Área verde y recreacional del noroeste (Distrito 3).',
        lat: -17.3630,
        lon: -66.1835,
        type: 'Parque Metropolitano',
      },
      {
        name: 'Cerro San Pedro (Área de Conservación)',
        desc: 'Monumento Cristo de la Concordia y franja vegetal este.',
        lat: -17.3845,
        lon: -66.1350,
        type: 'Área Protegida',
      },
      {
        name: 'Parque Metropolitano Mariscal Santa Cruz',
        desc: 'Complejo deportivo y forestado del oeste (Distrito 4).',
        lat: -17.3980,
        lon: -66.1770,
        type: 'Parque Urbano',
      },
    ];

    urbanGreenSpaces.forEach((g) => {
      const gMarker = L.circleMarker([g.lat, g.lon], {
        radius: 7,
        fillColor: '#10b981',
        color: '#ffffff',
        weight: 2,
        fillOpacity: 0.95,
      });
      gMarker.bindTooltip(
        `<strong>${g.name}</strong><br><span style="color:#059669;font-weight:600">${g.type}</span><br><small>${g.desc}</small>`,
        { direction: 'top', offset: [0, -6] }
      );
      gMarker.addTo(greenAreasLayer);
    });

    this.districtLayer = L.layerGroup().addTo(this.map);

    L.control.layers(
      {
        'OpenStreetMap (Contexto Urbano)': osmBase,
        'Solo Cercado (Fondo Limpio)': darkCanvas,
      },
      {
        'Cobertura Forestal y Parques': greenAreasLayer,
        'Escuelas': this.schoolsLayer,
        'Hospitales': this.hospitalsLayer,
        'Cota 2750 Parque Tunari': cota2750Line,
        'Distritos y Estaciones MÓNICA': this.districtLayer,
        'Evidencia Satelital NASA (MODIS 1km)': nasaNdviLayer,
        'Radio Urbano GAMC': distritosGamcWms,
      },
      { position: 'topright', collapsed: false }
    ).addTo(this.map);

    this.schoolsLayer.addTo(this.map);
    this.hospitalsLayer.addTo(this.map);
    greenAreasLayer.addTo(this.map);

    this.schoolsLayer.addTo(this.map);
    this.hospitalsLayer.addTo(this.map);

    if (this.districts().length > 0) {
      this.loadDistrictsGeoJson();
    }

    this.loadPoiLayer('school');
    this.loadPoiLayer('hospital');

    this.map.on('zoomend', () => {
      this.currentZoom.set(this.map!.getZoom());
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

        const areaText = props.area_km2 ? `<br>Superficie: <strong>${props.area_km2} km²</strong>` : '';

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
    this.selectedDistrict.set(district);
    if (!this.map) return;

    // Reset previous active polygon style & remove selected class
    if (this.activePolygon) {
      const prevElem = (this.activePolygon as any).getElement?.();
      prevElem?.classList.remove('district-selected');
      const prevProps = (this.activePolygon as any).feature?.properties;
      const prevFillColor = this.getFillColorForFeature(prevProps);
      this.activePolygon.setStyle({ ...this.defaultPolygonStyle, fillColor: prevFillColor, fillOpacity: 0.5, weight: 1.5 });
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
        // Deja espacio en la derecha para el panel lateral desplegable
        this.map.flyToBounds(bounds, {
          paddingTopLeft: [40, 40],
          paddingBottomRight: [440, 40],
          maxZoom: 14,
          duration: 1.0,
        });
      } else {
        this.map.flyTo([district.centroid.latitude, district.centroid.longitude], 14, {
          duration: 1.0,
        });
      }
    } else {
      this.map.flyTo([district.centroid.latitude, district.centroid.longitude], 14, {
        duration: 1.0,
      });
    }

    // Fetch suggestion for the selected district
    this.suggestionLoading.set(true);
    this.http
      .get<SuggestionResult>(`${this.API_BASE}/districts/${district.id}/suggestion`)
      .subscribe({
        next: (result) => {
          this.suggestion.set(result);
          this.suggestionLoading.set(false);
        },
        error: () => {
          this.suggestion.set(null);
          this.suggestionLoading.set(false);
        },
      });
  }

  clearSelection(): void {
    this.selectedDistrict.set(null);
    this.suggestion.set(null);
    this.suggestionLoading.set(false);

    if (this.activePolygon) {
      const prevElem = (this.activePolygon as any).getElement?.();
      prevElem?.classList.remove('district-selected');
      const prevProps = (this.activePolygon as any).feature?.properties;
      const prevFillColor = this.getFillColorForFeature(prevProps);
      this.activePolygon.setStyle({ ...this.defaultPolygonStyle, fillColor: prevFillColor, fillOpacity: 0.5, weight: 1.5 });
      this.activePolygon = undefined;
    }
    if (this.geoJsonLayer) {
      this.map?.flyToBounds(this.geoJsonLayer.getBounds(), {
        padding: [20, 20],
        duration: 0.8,
      });
    } else {
      this.map?.flyTo([-17.406, -66.174], 12, { duration: 0.8 });
    }
  }
}
