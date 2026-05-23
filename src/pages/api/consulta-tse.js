import { Pool } from 'pg';

let pool = null;

function getPool() {
  if (pool) return pool;

  const connectionString = process.env.TSE_DATABASE_URL;
  if (connectionString) {
    pool = new Pool({ connectionString });
    return pool;
  }

  const { TSE_DB_USER, TSE_DB_HOST, TSE_DB_NAME, TSE_DB_PASSWORD, TSE_DB_PORT } = process.env;
  if (!TSE_DB_USER || !TSE_DB_HOST || !TSE_DB_NAME || !TSE_DB_PASSWORD) {
    return null;
  }

  pool = new Pool({
    user: TSE_DB_USER,
    host: TSE_DB_HOST,
    database: TSE_DB_NAME,
    password: TSE_DB_PASSWORD,
    port: Number.parseInt(TSE_DB_PORT || '5432', 10),
  });

  return pool;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo nao permitido' });
  }

  const { zona, secao } = req.body;

  if (!zona || !secao) {
    return res.status(400).json({ error: 'Numero da zona e secao sao obrigatorios' });
  }

  const zonaNumero = Number.parseInt(String(zona), 10);
  const secaoNumero = Number.parseInt(String(secao), 10);

  if (Number.isNaN(zonaNumero) || Number.isNaN(secaoNumero)) {
    return res.status(400).json({ error: 'Zona e secao devem ser numericas' });
  }

  try {
    const tsePool = getPool();
    if (!tsePool) {
      return res.status(503).json({ error: 'Consulta TSE nao configurada' });
    }

    const result = await tsePool.query(
      `SELECT nm_municipio, nr_zona, nm_local_votacao
       FROM eleitorado
       WHERE nr_zona = $1 AND nr_secao = $2
       LIMIT 1`,
      [zonaNumero, secaoNumero]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Nenhum dado encontrado para esta zona e secao' });
    }

    const dados = result.rows[0];
    return res.status(200).json({
      municipio: dados.nm_municipio,
      zona: dados.nr_zona,
      localVotacao: dados.nm_local_votacao
    });
  } catch (error) {
    console.error('Erro ao consultar banco de dados:', error);
    return res.status(500).json({ error: 'Erro ao consultar banco de dados' });
  }
}
