import {
  Component,
  OnInit,
  AfterViewInit,
  inject,
  signal,
  ElementRef,
  viewChild,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import * as L from 'leaflet';

export interface Centroid {
  latitude: float;
  longitude: float;
}

export interface District {
  id: number;
  name: string;
  zone: string;
  has_fixed_sensor: boolean;
  station_name?: string | null;
  centroid: Centroid;
  bbox: [number, number, number, number];
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

  districts = signal<District[]>([]);
  selectedDistrict = signal<District | null>(null);
  isLoading = signal<boolean>(true);
  backendHealthy = signal<boolean>(false);

  private readonly API_BASE = 'http://localhost:8000/api/v1';

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
      },
      error: (err) => {
        console.error('Failed to load districts from backend:', err);
        this.isLoading.set(false);
      },
    });
  }

  private initMap(): void {
    const el = this.mapElement()?.nativeElement;
    if (!el) return;

    this.map = L.map(el).setView([-17.3895, -66.1568], 12);

    const osmBase = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors | EcoUrba Cochabamba',
      maxZoom: 18,
    }).addTo(this.map);

    // Official GAMC WMS Layers
    const distritosWms = L.tileLayer.wms(`${this.API_BASE}/gamc/wms`, {
      layers: 'limite_distritos',
      format: 'image/png',
      transparent: true,
      version: '1.1.1',
      maxZoom: 19,
      attribution: '&copy; GAMC GeoServer',
    }).addTo(this.map);

    const areasVerdesWms = L.tileLayer.wms(`${this.API_BASE}/gamc/wms`, {
      layers: 'areas_verdes',
      format: 'image/png',
      transparent: true,
      version: '1.1.1',
      maxZoom: 19,
      attribution: '&copy; GAMC GeoServer',
    }).addTo(this.map);

    const cota2750Wms = L.tileLayer.wms(`${this.API_BASE}/gamc/wms`, {
      layers: 'cota_2750',
      format: 'image/png',
      transparent: true,
      version: '1.1.1',
      maxZoom: 19,
      attribution: '&copy; GAMC GeoServer',
    });

    this.districtLayer = L.layerGroup().addTo(this.map);

    L.control.layers(
      { 'OpenStreetMap': osmBase },
      {
        '🌳 Áreas Verdes Oficiales (GAMC)': areasVerdesWms,
        '🏛️ Límites Distritales (GAMC)': distritosWms,
        '⛰️ Cota 2750 Parque Tunari (GAMC)': cota2750Wms,
        '📍 Distritos y Estaciones MÓNICA': this.districtLayer,
      },
      { position: 'topright', collapsed: false }
    ).addTo(this.map);
  }

  private renderDistrictsOnMap(districts: District[]): void {
    if (!this.map || !this.districtLayer) return;

    this.districtLayer.clearLayers();

    districts.forEach((d) => {
      const isSensor = d.has_fixed_sensor;

      const marker = L.circleMarker([d.centroid.latitude, d.centroid.longitude], {
        radius: isSensor ? 10 : 7,
        fillColor: isSensor ? '#10b981' : '#0284c7',
        color: '#ffffff',
        weight: isSensor ? 3 : 2,
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

    this.map.flyTo([district.centroid.latitude, district.centroid.longitude], 14, {
      duration: 1.0,
    });
  }

  clearSelection(): void {
    this.selectedDistrict.set(null);
    this.map?.flyTo([-17.3895, -66.1568], 12, { duration: 1.0 });
  }
}
