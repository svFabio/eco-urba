// Ejemplo para integrar el GeoJSON en un mapa Mapbox GL JS existente.
// El proyecto debe servir los archivos vía HTTP(S), no abrirse desde file://.
async function instalarDistritosNASA(map) {
  const url = './COCHA360_DISTRITOS_INDICADORES.geojson';
  const data = await (await fetch(url)).json();
  map.addSource('cocha-distritos-nasa', {type:'geojson', data});
  map.addLayer({id:'cocha-distritos-nasa-borde',type:'line',source:'cocha-distritos-nasa',paint:{'line-color':'#63e6ce','line-width':2}});
  map.on('click', 'cocha-distritos-nasa-borde', (event) => {
    const p = event.features[0].properties;
    const serie = typeof p.serie_anual === 'string' ? JSON.parse(p.serie_anual) : p.serie_anual;
    console.log('Distrito',p.distrito,'NDVI 2025',p.ndvi_2025,'LST 2025',p.lst_2025_c, 'Hotspot 2024', p.hotspot_2024_km2, 'Serie',serie);
    // Enlaza los valores reales con el panel de tu mockup.
  });
}
// Llamar instalarDistritosNASA(map) después del evento load del mapa.
