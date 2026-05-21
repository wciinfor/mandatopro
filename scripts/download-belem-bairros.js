const https = require('https');
const fs = require('fs');
const path = require('path');

// Query usando a área do município de Belém/PA para pegar apenas os bairros oficiais
// admin_level=8 = município, admin_level=9 = distrito, admin_level=10 = bairro
const query = `
[out:json][timeout:120];
area["name"="Belém"]["admin_level"="8"]["boundary"="administrative"]->.belem;
(
  relation(area.belem)["admin_level"="10"]["boundary"="administrative"];
  relation(area.belem)["admin_level"="9"]["boundary"="administrative"];
  way(area.belem)["admin_level"="10"]["boundary"="administrative"];
);
out geom;
`.trim();

const endpoints = [
  'https://overpass.openstreetmap.ru/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];

function download(url, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
        'User-Agent': 'mandatopro/1.0',
      },
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (d) => { chunks.push(d); process.stdout.write('.'); });
      res.on('end', () => {
        console.log('\nStatus:', res.statusCode);
        resolve({ status: res.statusCode, data: Buffer.concat(chunks).toString('utf8') });
      });
    });

    req.on('error', reject);
    req.setTimeout(95000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(body);
    req.end();
  });
}

async function main() {
  const body = 'data=' + encodeURIComponent(query);
  let result = null;

  for (const endpoint of endpoints) {
    console.log('\nTentando:', endpoint);
    try {
      result = await download(endpoint, body);
      if (result.status === 200) break;
      console.log('Falhou com status', result.status);
    } catch (e) {
      console.log('Erro:', e.message);
    }
  }

  if (!result || result.status !== 200) {
    console.error('Todos os endpoints falharam.');
    process.exit(1);
  }

  const json = JSON.parse(result.data);
  console.log('Elementos OSM:', json.elements ? json.elements.length : 0);

  const features = [];

  for (const el of (json.elements || [])) {
    const name = el.tags && (el.tags.name || el.tags['name:pt']);
    if (!name) continue;

    let geometry = null;

    if (el.type === 'way' && el.geometry && el.geometry.length >= 3) {
      const coords = el.geometry.map((p) => [p.lon, p.lat]);
      const first = coords[0];
      const last = coords[coords.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) coords.push(first);
      geometry = { type: 'Polygon', coordinates: [coords] };
    } else if (el.type === 'relation') {
      // Relações: tentar reconstruir o outer ring a partir dos membros
      const outers = (el.members || []).filter((m) => m.role === 'outer' && m.geometry);
      if (outers.length > 0) {
        const coords = outers.flatMap((m) => m.geometry.map((p) => [p.lon, p.lat]));
        if (coords.length >= 3) {
          const first = coords[0];
          const last = coords[coords.length - 1];
          if (first[0] !== last[0] || first[1] !== last[1]) coords.push(first);
          geometry = { type: 'Polygon', coordinates: [coords] };
        }
      }
    }

    if (geometry) {
      features.push({
        type: 'Feature',
        properties: { name, osm_id: el.id, place: el.tags && el.tags.place },
        geometry,
      });
    }
  }

  console.log('Features GeoJSON gerados:', features.length);

  const geojson = { type: 'FeatureCollection', features };
  const outPath = path.join(process.cwd(), 'public', 'data', 'geo', 'belem-bairros.geojson');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(geojson));
  console.log('Salvo em:', outPath);
}

main().catch((e) => { console.error(e); process.exit(1); });
