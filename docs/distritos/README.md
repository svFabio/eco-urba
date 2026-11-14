# Límites Distritales de Cochabamba (Cercado) y Análisis del Servicio WMS Municipal

Este directorio documenta la estructura geográfica de los **15 Distritos Municipales de Cochabamba (Cercado)** utilizada en **EcoUrba**, y detalla el motivo técnico por el cual no se utiliza la capa WMS raster de la Alcaldía (GAMC) para el trazado de las divisiones distritales.

---

## 1. Diagnóstico del Servicio WMS de la Alcaldía (GAMC)

El Gobierno Autónomo Municipal de Cochabamba (GAMC) provee un endpoint GeoServer WMS (`https://serviciosgamc.cochabamba.bo/api/gs/wms`). 

### Comportamiento Observado:
1. **Ausencia de Divisiones Internas:** Al solicitar la capa catalogada como *"Límite Distritos · Simple"*, el servidor genera una imagen rasterizada (PNG) con un único polígono envolvente de **159.24 km²** (el perímetro externo completo del municipio de Cercado) relleno con un color verde azulado sólido (`#47beab`).
2. **Sin Líneas de Separación:** No traza las líneas divisorias entre los distritos 1 al 15. En el mapa, el resultado es una "mancha" opaca que cubre toda la mancha urbana e impide distinguir qué zona corresponde a cada distrito.
3. **Respuesta de `GetFeatureInfo` Monolítica:**
   ```json
   {
     "type": "FeatureCollection",
     "features": [
       {
         "type": "Feature",
         "id": "",
         "geometry": null,
         "properties": {
           "Área": "159242888.892"
         }
       }
     ]
   }
   ```
   No expone identificadores de distrito (`distrito_id`), nombres, ni geometrías independientes por cada unidad territorial.

---

## 2. Solución Vectorial Oficial: `distritos_cercado_cochabamba.geojson`

Para solventar esta limitación técnica y permitir el sensado virtual por distrito en el reto de la NASA Space Apps Challenge, incorporamos el archivo vectorial oficial de los 15 distritos:

- **Archivo:** [`distritos_cercado_cochabamba.geojson`](./distritos_cercado_cochabamba.geojson)
- **Sistema de Coordenadas:** EPSG:4326 (WGS84 Latitud/Longitud)
- **Tipo de Geometría:** `MultiPolygon` (15 features correspondientes a los 15 distritos)

### Atributos por Feature:
```json
{
  "type": "Feature",
  "geometry": { "type": "MultiPolygon", "coordinates": [...] },
  "properties": {
    "distrito": 1,
    "nombre": "Distrito 1",
    "municipio": "Cochabamba (Cercado)",
    "area_km2": 5.695
  }
}
```

### Tabla de Superficies Oficiales por Distrito:

| Distrito | Nombre / Zona Principal | Superficie (km²) | Tipo de Monitoreo |
| :---: | :--- | :---: | :--- |
| **D1** | Tunari (Norte) | 5.695 | Sensado Virtual Satelital |
| **D2** | Muyurina (Noreste) | 9.075 | Sensado Virtual Satelital |
| **D3** | Sarco (Noroeste) | 8.156 | Sensado Virtual Satelital |
| **D4** | Cala Cala (Norte Urbano) | 8.344 | Sensado Virtual Satelital |
| **D5** | Alalay (Sur Central) | 10.444 | **Sensor Físico** (Av. 6 de Agosto - Red MÓNICA) |
| **D6** | San Antonio (Este Urbano) | 9.010 | Sensado Virtual Satelital |
| **D7** | Tamborada (Sur) | 5.175 | Sensado Virtual Satelital |
| **D8** | Jaihuayco (Suroeste) | 24.740 | Sensado Virtual Satelital |
| **D9** | Pucara / Arrumani (Extremo Sur) | 118.282 | Sensado Virtual Satelital |
| **D10** | Centro Histórico (Centro) | 5.602 | Sensado Virtual Satelital |
| **D11** | Las Cuadras (Centro Este) | 5.559 | Sensado Virtual Satelital |
| **D12** | Queru Queru (Noreste Urbano) | 7.653 | **Sensor Físico** (Av. Circunvalación - Red MÓNICA) |
| **D13** | Condebamba (Noroeste Semi-urbano) | 48.783 | Sensado Virtual Satelital |
| **D14** | Valle Hermoso (Sureste) | 6.939 | Sensado Virtual Satelital |
| **D15** | K'ara K'ara (Sur Periférico) | 21.224 | Sensado Virtual Satelital |

---

## 3. Integración en la Arquitectura de EcoUrba

1. **Backend FastAPI:**
   - `DistrictService` lee el archivo GeoJSON desde `docs/distritos/` o `backend/src/backend/data/`.
   - El endpoint `GET /api/v1/districts/geojson` devuelve el `FeatureCollection` enriquecido con metadatos de las estaciones fijas de la Red MÓNICA.
2. **Frontend Angular + Leaflet:**
   - La capa vectorial dibuja los límites con trazo púrpura (`#795290`), idéntico al visor geográfico municipal de referencia.
   - Cada polígono soporta hover interactivo, tooltip con superficie oficial y evento clic para enfocar la vista (`flyToBounds`) en el distrito seleccionado.
3. **Capa WMS Raster:**
   - Se mantiene disponible en el selector de capas de Leaflet como capa opcional (`GAMC WMS Raster`), pero desmarcada por defecto para evitar que su relleno verde tape las divisiones vectoriales.
