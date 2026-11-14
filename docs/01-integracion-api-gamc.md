# Integración API GeoServer WMS - GAMC Cochabamba

> **Nota de Seguridad:** Las credenciales reales (`GAMC_API_KEY` y `GAMC_SERVICE_ID`) deben gestionarse exclusivamente a través de variables de entorno (`.env`). Nunca commitear credenciales en texto plano.

---

### 01 · CURL / GETMAP
```bash
curl -G "https://serviciosgamc.cochabamba.bo/api/gs/wms" \
  --data-urlencode "key=YOUR_GAMC_API_KEY" \
  --data-urlencode "service_id=YOUR_GAMC_SERVICE_ID" \
  --data-urlencode "SERVICE=WMS" \
  --data-urlencode "VERSION=1.1.1" \
  --data-urlencode "REQUEST=GetMap" \
  --data-urlencode "LAYERS=your_layer_name" \
  --data-urlencode "FORMAT=image/png" \
  --data-urlencode "TRANSPARENT=true" \
  --data-urlencode "SRS=EPSG:3857" \
  --data-urlencode "BBOX=-7364284.32,-1966770.99,-7363284.32,-1965770.99" \
  --data-urlencode "WIDTH=256" \
  --data-urlencode "HEIGHT=256"
```

---

### 02 · JAVASCRIPT / LEAFLET WMS
```javascript
const capa = L.tileLayer.wms('https://serviciosgamc.cochabamba.bo/api/gs/wms', {
  key: process.env.GAMC_API_KEY || 'YOUR_GAMC_API_KEY',
  service_id: process.env.GAMC_SERVICE_ID || 'YOUR_GAMC_SERVICE_ID',
  layers: 'distritos_municipales',
  format: 'image/png',
  transparent: true,
  version: '1.1.1',
  maxZoom: 19
});
capa.addTo(map);
```

---

### 03 · GETLEGENDGRAPHIC
```javascript
const params = new URLSearchParams({
  key: process.env.GAMC_API_KEY || 'YOUR_GAMC_API_KEY',
  service_id: process.env.GAMC_SERVICE_ID || 'YOUR_GAMC_SERVICE_ID',
  REQUEST: 'GetLegendGraphic',
  VERSION: '1.0.0',
  FORMAT: 'image/png'
});
const legendUrl = `https://serviciosgamc.cochabamba.bo/api/gs/wms?${params}`;
```

---

### 04 · GETFEATUREINFO
```javascript
// En WMS 1.1.1, X e Y son píxeles dentro del BBOX solicitado.
const params = new URLSearchParams({
  key: process.env.GAMC_API_KEY || 'YOUR_GAMC_API_KEY',
  service_id: process.env.GAMC_SERVICE_ID || 'YOUR_GAMC_SERVICE_ID',
  SERVICE: 'WMS',
  VERSION: '1.1.1',
  REQUEST: 'GetFeatureInfo',
  SRS: 'EPSG:3857',
  BBOX: bbox,
  WIDTH: String(width),
  HEIGHT: String(height),
  X: String(pixelX),
  Y: String(pixelY),
  INFO_FORMAT: 'application/json',
  FEATURE_COUNT: '5'
});
const response = await fetch(`https://serviciosgamc.cochabamba.bo/api/gs/wms?${params}`);
const geojson = await response.json();
```
