export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo nao permitido' });
  }

  return res.status(503).json({
    error: 'Consulta TSE temporariamente indisponivel. A base sera reconfigurada em uma nova VPS.'
  });
}
