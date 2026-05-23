export const runtime = 'nodejs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo nao permitido' });
  }

  try {
    const { address } = req.body || {};
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'Google Maps API key nao configurada' });
    }

    if (!address || typeof address !== 'string' || address.trim().length < 5) {
      return res.status(400).json({ error: 'Endereco invalido para geocodificacao' });
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
    const response = await fetch(url);

    if (!response.ok) {
      return res.status(502).json({ error: 'Falha ao consultar geocodificacao' });
    }

    const data = await response.json();

    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      return res.status(404).json({ error: `Endereco nao encontrado: ${data.status}` });
    }

    const location = data.results[0].geometry.location;

    return res.status(200).json({
      latitude: location.lat,
      longitude: location.lng,
      formattedAddress: data.results[0].formatted_address
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Erro interno' });
  }
}
