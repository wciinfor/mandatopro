const fs = require('fs');
const data = JSON.parse(fs.readFileSync('public/data/geo/pa-municipios.geojson', 'utf8'));
const ids = data.features.map(f => ({ id: f.properties.id, name: f.properties.name }));

console.log('Total de municipios no geojson:', ids.length);
console.log('\nPrimeiros 15:');
ids.slice(0, 15).forEach(m => console.log(`  ${m.id}: ${m.name}`));

console.log('\n\nProcurando por codigos que comecam com 150 (PA):');
const paCodes = ids.filter(m => m.id.startsWith('150'));
console.log(`Total de codigos PA (150xxxxx): ${paCodes.length}`);

console.log('\nVerificando codigos especificos:');
['1501402', '1501403', '1501004', '1500107', '1500206'].forEach(code => {
  const found = ids.find(m => m.id === code);
  console.log(`  ${code}: ${found ? found.name : 'NAO ENCONTRADO'}`);
});
