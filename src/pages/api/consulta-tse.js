import { Pool } from 'pg';

// Configuração do pool de conexões PostgreSQL
const pool = new Pool({
  user: 'bubble_read',
  host: '69.62.100.1',
  database: 'tse_eleitores',
  password: 'Siren001',
  port: 5432,
});

export default async function handler(req, res) {
  // Apenas aceita método POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { secao } = req.body;

  // Validação
  if (!secao) {
    return res.status(400).json({ error: 'Número da seção é obrigatório' });
  }

  try {
    // Executa a query no PostgreSQL
    const result = await pool.query(
      `SELECT nm_municipio, nr_zona, nm_local_votacao 
       FROM eleitorado 
       WHERE nr_secao = $1 
       LIMIT 1`,
      [secao]
    );

    // Verifica se encontrou resultados
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Nenhum dado encontrado para esta seção' });
    }

    // Retorna os dados encontrados
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
