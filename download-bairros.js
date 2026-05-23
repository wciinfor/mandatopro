const https = require('https');
const fs = require('fs');
const path = require('path');

const query = encodeURIComponent('[out:json][timeout:60];(way["place"~"suburb|neighbourhood"]["name"](S:-1.52,W:-48.55,N:-1.30,E:-48.35);relation["place"~"suburb|neighbourhood"]["name"](S:-1.52,W:-48.55,N:-1.30,E:-48.35););out geom;');

const url = 'https://overpass.kumi.systems/api/interpreter?data=' + query;
console.log('Iniciando download via Overpass API (kumi)...');

const req = https.get(url, {headers: {'User-Agent': 'mandato-pro/1.0'}}, (res) => {
  let data = '';
  res.on('data', d => { data += d; process.stdout.write('.'); });
  res.on('end', () => {
    console.log('\nStatus:', res.statusCode, '| Bytes:', data.length);
    if (res.statusCode !== 200) { console.error('Erro HTTP:', res.statusCode); console.log(data.substring(0, 500)); return; }
    try {
      const json = JSON.parse(data);
      console.log('Elementos retornados:', json.elements ? json.elements.length : 0);
      if (!json.elements || json.elements.length === 0) { console.log('Nenhum elemento encontrado.', data.substring(0,300)); return; }
      const features = [];
      json.elements.forEach(el => {
        if (el.type === 'relation' || el.type === 'way') {
          const name = (el.tags && (el.tags.name || el.tags['name:pt'])) || 'Sem nome';
          let geometry = null;
          if (el.type === 'way' && el.geometry) {
            geometry = { type: 'Polygon', coordinates: [[...el.geometry.map(p => [p.lon, p.lat])]] };
            const coords = geometry.coordinates[0];
            if (coords.length > 0) { const f=coords[0],l=coords[coords.length-1]; if(f[0]!==l[0]||f[1]!==l[1]) coords.push(f); }
          }
          if (geometry) features.push({ type: 'Feature', properties: { name, osm_id: el.id, place: el.tags && el.tags.place }, geometry });
        }
      });
      const geojson = { type: 'FeatureCollection', features };
      const outPath = path.join('public', 'data', 'geo', 'belem-bairros.geojson');
      require('fs').mkdirSync(path.dirname(outPath), { recursive: true });
      require('fs').writeFileSync(outPath, JSON.stringify(geojson));
      console.log('Salvo em', outPath, '| Features:', features.length);
    } catch(e) { console.error('Erro:', e.message); console.log(data.substring(0,300)); }
  });
});
req.on('error', e => console.error('Erro de rede:', e.message));
req.setTimeout(70000, () => { req.destroy(); console.error('Timeout!'); });
