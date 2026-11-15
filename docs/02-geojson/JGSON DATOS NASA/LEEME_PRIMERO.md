# COCHA 360 — entrega GeoJSON para Mapbox GL JS

## Archivos
- `COCHA360_DISTRITOS_INDICADORES.geojson`: 15 polígonos, datos 2024/2025, hotspots de 2024 y serie de 2016–2025 dentro de `properties.serie_anual`.
- `COCHA360_DISTRITOS_POR_ANIO.geojson`: 150 geometrías (15 distritos × 10 años) con propiedades planas `anio`, `ndvi_media` y `lst_media_c` para filtros en Mapbox GL JS. Incluye datos de hotspots **solo de 2024**, no interpretes `hotspot_2024_*` como resultados de cada año.
- `EJEMPLO_MAPBOX_GL_JS.js`: ejemplo de conexión por fuente GeoJSON y consulta distrital.

## Cómo integrarlo
Hospeda el archivo GeoJSON con el proyecto web y agrégalo a Mapbox GL JS como fuente `type: 'geojson'`. Después puedes usar `queryRenderedFeatures` o un evento `click` sobre una capa `fill`/`line` para leer `properties` de cada distrito. En GeoJSON de series anidadas, Mapbox GL JS puede convertir `serie_anual` a texto JSON; por ello el ejemplo contempla `JSON.parse`. Para cambiar año en la vista de 150 features utiliza un filtro `['==',['get','anio'],2025]`.

## Límites científicos y geográficos
1. Los 15 polígonos de PLANETERRA son **provisionales**, con solapamientos identificados; sustituirlos por límites oficiales GAMC antes de usar en decisiones.
2. Los indicadores históricos son promedios distritales previos de PLANETERRA y deben auditarse para comparar temporadas, fuentes y calidad.
3. Hotspots de 2024 son proporciones calculadas sobre **píxeles válidos**, no toda la superficie legal.
4. Este GeoJSON **NO** da valor por cada punto de 30 m. Para consulta puntual de NDVI/LST/elevación se requiere mantener los GeoTIFF originales y publicar una API de muestreo sobre raster o COG. Convertir todos los píxeles a GeoJSON sería pesado, impreciso para zoom y poco recomendable para Mapbox.
5. El mapa de visualización PNG y este GeoJSON cumplen funciones distintas: representación visual y consultas distritales.

Fuente: archivos originales facilitados en el proyecto COCHA 360. No son datos inventados.
