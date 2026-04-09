export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key no configurada' });

  // Parsear body manualmente si viene como string
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch(e) { body = {}; }
  }

  const { image, mediaType } = body || {};

  if (!image || !mediaType) {
    return res.status(400).json({
      error: 'Faltan datos de imagen',
      received: { hasImage: !!image, hasMediaType: !!mediaType, bodyType: typeof body }
    });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: image }
            },
            {
              type: 'text',
              text: `Eres un asistente de nutrición. Analiza esta etiqueta nutricional y extrae los datos por 100g.
Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional, sin bloques de código:
{
  "nombre": "nombre del producto si se ve, si no cadena vacía",
  "marca": "marca si se ve, si no cadena vacía",
  "kcal": número o null,
  "grasas": número o null,
  "saturadas": número o null,
  "hidratos": número o null,
  "azucares": número o null,
  "proteinas": número o null,
  "fibra": número o null,
  "sal": número o null
}
Todos los valores numéricos son por 100g. Si no puedes leer un valor ponlo como null.`
            }
          ]
        }]
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: err?.error?.message || 'Error de API' });
    }

    const data = await response.json();
    const text = data.content?.find(b => b.type === 'text')?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    return res.status(200).json(parsed);

  } catch (e) {
    return res.status(500).json({ error: e.message || 'Error interno' });
  }
}
