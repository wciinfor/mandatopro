const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

const client = createClient(supabaseUrl, supabaseKey);

(async () => {
  try {
    console.log('Investigando código IBGE "15"...\n');

    // Buscar registros com id_municipio = 15
    const { data: records15, error: error15 } = await client
      .from('eleitores')
      .select('id, nome, id_municipio, municipio, cidade')
      .eq('id_municipio', 15)
      .limit(10);

    if (error15) {
      console.log('Erro ao buscar registros:', error15.message);
    } else {
      console.log(`Encontrados ${records15.length} registros com id_municipio = 15:`);
      records15.forEach(r => {
        console.log(`  - ID: ${r.id}, Nome: ${r.nome}, Municipio: ${r.municipio}, Cidade: ${r.cidade}`);
      });
    }

    // Também verificar alguns registros válidos
    console.log('\n\nExemplos de registros com id_municipio válido:');
    const { data: validRecords } = await client
      .from('eleitores')
      .select('id, nome, id_municipio, municipio')
      .in('id_municipio', [1501402, 1501105, 1501709])
      .limit(3);

    if (validRecords) {
      validRecords.forEach(r => {
        console.log(`  - ID: ${r.id}, ID_Municipio: ${r.id_municipio}, Nome: ${r.nome}, Municipio: ${r.municipio}`);
      });
    }

    process.exit(0);
  } catch (err) {
    console.error('Erro:', err);
    process.exit(1);
  }
})();
