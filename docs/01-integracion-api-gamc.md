01 · CURL / GETMAP
Copiar código ⧉
curl -G "https://serviciosgamc.cochabamba.bo/api/gs/wms" --data-urlencode "key=1a3d2d9c6e1d6a94062d11a9021a48b24ae0e05e8183e9d8" --data-urlencode "service_id=fd77d463-9729-4c66-b686-23dccbb4ab8f" --data-urlencode "SERVICE=WMS" --data-urlencode "VERSION=1.1.1" --data-urlencode "REQUEST=GetMap" --data-urlencode "LAYERS=" --data-urlencode "FORMAT=image/png" --data-urlencode "TRANSPARENT=true" --data-urlencode "SRS=EPSG:3857" --data-urlencode "BBOX=-7364284.32,-1966770.99,-7363284.32,-1965770.99" --data-urlencode "WIDTH=256" --data-urlencode "HEIGHT=256"
02 · JAVASCRIPT / LEAFLET WMS
Copiar código ⧉
const capa = L.tileLayer.wms('https://serviciosgamc.cochabamba.bo/api/gs/wms', {
  key: '1a3d2d9c6e1d6a94062d11a9021a48b24ae0e05e8183e9d8',
  service_id: 'fd77d463-9729-4c66-b686-23dccbb4ab8f',
  layers: '',
  format: 'image/png',
  transparent: true,
  version: '1.1.1',
  maxZoom: 19
});
capa.addTo(map);
03 · GETLEGENDGRAPHIC
Copiar código ⧉
const params = new URLSearchParams({
  key: '1a3d2d9c6e1d6a94062d11a9021a48b24ae0e05e8183e9d8',
  service_id: 'fd77d463-9729-4c66-b686-23dccbb4ab8f',
  REQUEST: 'GetLegendGraphic',
  VERSION: '1.0.0',
  FORMAT: 'image/png'
});
const legendUrl = `https://serviciosgamc.cochabamba.bo/api/gs/wms?${params}`;
04 · GETFEATUREINFO
Copiar código ⧉
// En WMS 1.1.1, X e Y son píxeles dentro del BBOX solicitado.
const params = new URLSearchParams({
  key: '1a3d2d9c6e1d6a94062d11a9021a48b24ae0e05e8183e9d8',
  service_id: 'fd77d463-9729-4c66-b686-23dccbb4ab8f',
  SERVICE: 'WMS', VERSION: '1.1.1',
  REQUEST: 'GetFeatureInfo',
  SRS: 'EPSG:3857', BBOX: bbox,
  WIDTH: String(width), HEIGHT: String(height),
  X: String(pixelX), Y: String(pixelY),
  INFO_FORMAT: 'application/json', FEATURE_COUNT: '5'
});
const response = await fetch(`https://serviciosgamc.cochabamba.bo/api/gs/wms?${params}`);
const geojson = await response.json();
