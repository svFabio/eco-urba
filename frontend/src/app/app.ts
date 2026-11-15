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
    color: '#795290',
    weight: 2.5,
    opacity: 0.95,
    fillColor: '#8b5cf6',
    fillOpacity: 0.12,
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

  getCanopyPct(d: District): number {
    return d.tree_canopy_pct ?? d.microclimate?.tree_canopy_pct ?? 0;
  }

  private readonly hoverPolygonStyle: L.PathOptions = {
    color: '#4c1d95',
    weight: 3.5,
    opacity: 1,
    fillColor: '#7c3aed',
    fillOpacity: 0.25,
  };

  private readonly selectedPolygonStyle: L.PathOptions = {
    color: '#2563eb',
    weight: 4,
    opacity: 1,
    fillColor: '#3b82f6',
    fillOpacity: 0.35,
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
    const emoji = type === 'school' ? '🏫' : '🏥';
    const targetLayer = type === 'school' ? this.schoolsLayer : this.hospitalsLayer;

    this.http.get<any[]>(`${this.API_BASE}/pois?type=${type}`).subscribe({
      next: (pois) => {
        targetLayer.clearLayers();
        pois.forEach((poi) => {
          const icon = L.divIcon({
            html: `<span class="poi-pin">${emoji}</span>`,
            className: '',
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          });
          const marker = L.marker([poi.latitude, poi.longitude], { icon });
          marker.bindTooltip(poi.name ?? `${emoji} POI`, { direction: 'top', offset: [0, -10] });
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

    // Capa Satelital NASA GIBS: Índice de Vegetación (NDVI) MODIS Terra
    const nasaNdviLayer = L.tileLayer.wms('https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi', {
      layers: 'MODIS_Terra_L3_NDVI_Monthly',
      format: 'image/png',
      transparent: true,
      version: '1.1.1',
      opacity: 0.65,
      attribution: '&copy; NASA EOSDIS GIBS · MODIS Terra NDVI',
    });

    // Parques y Reservas Verdes emblemáticas de Cochabamba
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
        radius: 8,
        fillColor: '#16a34a',
        color: '#ffffff',
        weight: 2,
        fillOpacity: 0.9,
      });
      gMarker.bindTooltip(
        `<strong>🌳 ${g.name}</strong><br><span style="color:#16a34a;font-weight:600">${g.type}</span><br><small>${g.desc}</small>`,
        { direction: 'top', offset: [0, -6] }
      );
      gMarker.addTo(greenAreasLayer);
    });

    this.districtLayer = L.layerGroup().addTo(this.map);

    L.control.layers(
      {
        '🗺️ OpenStreetMap (Calles y Contexto)': osmBase,
        '🌌 Solo Cercado (Fondo Limpio Sin Mapa Mundial)': darkCanvas,
      },
      {
        '🌿 Vegetación Satelital (NASA NDVI)': nasaNdviLayer,
        '🌳 Parques y Reservas Verdes': greenAreasLayer,
        '⛰️ Cota 2750 Parque Tunari (Línea Legal)': cota2750Line,
        '📍 Distritos y Estaciones MÓNICA': this.districtLayer,
        'Escuelas': this.schoolsLayer,
        'Hospitales': this.hospitalsLayer,
        '🏛️ Radio Urbano GAMC (WMS Alcaldía - No son áreas verdes)': distritosGamcWms,
      },
      { position: 'topright', collapsed: false }
    ).addTo(this.map);

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
        const risk = (feature?.properties?.heat_island_risk || feature?.properties?.microclimate?.heat_island_risk) as string | undefined;
        const fillColor = risk ? this.getDistrictColor(risk) : '#8b5cf6';
        return {
          ...this.defaultPolygonStyle,
          fillColor,
          fillOpacity: 0.5,
          weight: 2,
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
          ? `<br><span style="color:#10b981;font-weight:600">📡 Sensor MÓNICA: ${props.station_name}</span>`
          : '<br><span style="color:#64748b;font-style:italic">Sensado Virtual</span>';

        const areaText = props.area_km2 ? `<br>📐 Superficie: <strong>${props.area_km2} km²</strong>` : '';

        layer.bindPopup(
          `<strong>${props.name}</strong><br><span style="color:#64748b">${props.zone}</span>${areaText}${sensorText}`
        );

        layer.on('mouseover', () => {
          if (this.activePolygon !== pathLayer) {
            pathLayer.setStyle({ weight: 4, fillOpacity: 0.75 });
            pathLayer.bringToFront();
          }
        });

        layer.on('mouseout', () => {
          if (this.activePolygon !== pathLayer) {
            if (this.geoJsonLayer) {
              this.geoJsonLayer.resetStyle(pathLayer);
            } else {
              const risk = feature?.properties?.heat_island_risk as string | undefined;
              const fillColor = risk ? this.getDistrictColor(risk) : '#8b5cf6';
              pathLayer.setStyle({ ...this.defaultPolygonStyle, fillColor, fillOpacity: 0.5, weight: 2 });
            }
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
        ? `<strong>📡 Estación Red MÓNICA</strong><br>${d.station_name}<br><span style="color:#64748b">${d.name} (${d.zone})</span>`
        : `<strong>${d.name}</strong><br><span style="color:#64748b">${d.zone}</span>`;

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
      if (this.geoJsonLayer) {
        this.geoJsonLayer.resetStyle(this.activePolygon);
      } else {
        this.activePolygon.setStyle(this.defaultPolygonStyle);
      }
    }

    const poly = this.polygonMap.get(district.id);
    if (poly) {
      poly.setStyle(this.selectedPolygonStyle);
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
      if (this.geoJsonLayer) {
        this.geoJsonLayer.resetStyle(this.activePolygon);
      } else {
        this.activePolygon.setStyle(this.defaultPolygonStyle);
      }
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
