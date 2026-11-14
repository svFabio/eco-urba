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

    const gamcWms = L.tileLayer.wms(`${this.API_BASE}/gamc/wms`, {
      layers: 'limite_distritos',
      format: 'image/png',
      transparent: true,
      version: '1.1.1',
      maxZoom: 19,
      attribution: '&copy; GAMC Cochabamba GeoServer',
    }).addTo(this.map);

    this.districtLayer = L.layerGroup().addTo(this.map);

    L.control.layers(
      { 'OpenStreetMap Base': osmBase },
      {
        'Límites Distritales GAMC (Oficial)': gamcWms,
        'Distritos y Sensores EcoUrba': this.districtLayer,
      },
      { position: 'topright' }
    ).addTo(this.map);
  }

  private renderDistrictsOnMap(districts: District[]): void {
    if (!this.map || !this.districtLayer) return;

    this.districtLayer.clearLayers();

    districts.forEach((d) => {
      const minLon = d.bbox[0];
      const minLat = d.bbox[1];
      const maxLon = d.bbox[2];
      const maxLat = d.bbox[3];

      const bounds: L.LatLngBoundsExpression = [
        [minLat, minLon],
        [maxLat, maxLon],
      ];

      const color = d.has_fixed_sensor ? '#10b981' : '#3b82f6';

      const rect = L.rectangle(bounds, {
        color: color,
        weight: 1.5,
        fillOpacity: 0.12,
      });

      rect.bindTooltip(
        `<strong>${d.name}</strong><br>${d.zone}${
          d.has_fixed_sensor ? '<br>📡 ' + d.station_name : ''
        }`,
        { permanent: false, direction: 'center' }
      );

      rect.on('click', () => this.selectDistrict(d));
      rect.addTo(this.districtLayer!);

      // Fixed station marker
      if (d.has_fixed_sensor) {
        const marker = L.circleMarker([d.centroid.latitude, d.centroid.longitude], {
          radius: 8,
          fillColor: '#10b981',
          color: '#ffffff',
          weight: 2,
          fillOpacity: 0.9,
        });
        marker.bindPopup(`<strong>Estación Fija Red MÓNICA</strong><br>${d.station_name}`);
        marker.addTo(this.districtLayer!);
      }
    });
  }

  selectDistrict(district: District): void {
    this.selectedDistrict.set(district);
    if (!this.map) return;

    const [minLon, minLat, maxLon, maxLat] = district.bbox;
    this.map.fitBounds([
      [minLat, minLon],
      [maxLat, maxLon],
    ]);
  }

  clearSelection(): void {
    this.selectedDistrict.set(null);
    this.map?.setView([-17.3895, -66.1568], 12);
  }
}
