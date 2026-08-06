import { createClient } from 'npm:@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Rough buy-back rate table (currency-agnostic baseline) used when no vendor
// rate is available yet. Values are per kg.
const BASELINE_RATES: Record<string, number> = {
  'Plastic PET': 0.4,
  'Plastic HDPE': 0.35,
  'Plastic': 0.3,
  'Cardboard': 0.2,
  'Paper': 0.15,
  'Aluminum': 1.2,
  'Steel': 0.5,
  'Glass': 0.1,
  'Electronics': 2.5,
  'Organic': 0.05,
  'Textile': 0.25,
  'Wood': 0.3,
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      return jsonResponse({ error: 'Missing authorization token' }, 401);
    }

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return jsonResponse({ error: 'Invalid or expired session' }, 401);
    }

    const body = await req.json();
    const { imageBase64, mimeType } = body as { imageBase64?: string; mimeType?: string };
    if (!imageBase64 || !mimeType) {
      return jsonResponse({ error: 'imageBase64 and mimeType are required' }, 400);
    }

    if (!GEMINI_API_KEY) {
      return jsonResponse({ error: 'Gemini API key not configured. Add GEMINI_API_KEY as an edge function secret.' }, 500);
    }

    const prompt = `You are a waste-classification assistant for a recycling marketplace.
Analyze this image of waste material and respond ONLY with a JSON object (no markdown, no prose) with these exact fields:
{
  "material_type": one of ["Plastic PET","Plastic HDPE","Plastic","Cardboard","Paper","Aluminum","Steel","Glass","Electronics","Organic","Textile","Wood","Mixed","Unknown"],
  "title": a short descriptive title for the listing (max 60 chars),
  "estimated_weight_kg": a positive number estimating the weight in kg,
  "confidence": a number between 0 and 1 indicating classification confidence,
  "notes": a one-sentence note about condition or handling
}`;

    const geminiRes = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType, data: imageBase64 } },
            ],
          },
        ],
        generationConfig: { temperature: 0.2, maxOutputTokens: 400, responseMimeType: 'application/json' },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return jsonResponse({ error: `Gemini API error (${geminiRes.status}): ${errText}` }, 502);
    }

    const geminiJson = await geminiRes.json();
    const text: string | undefined = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return jsonResponse({ error: 'Gemini returned no content' }, 502);
    }

    let parsed: {
      material_type: string;
      title: string;
      estimated_weight_kg: number;
      confidence: number;
      notes: string;
    };
    try {
      parsed = JSON.parse(text);
    } catch {
      // Fallback: try to extract JSON substring
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return jsonResponse({ error: 'Could not parse Gemini response as JSON' }, 502);
      parsed = JSON.parse(match[0]);
    }

    // Derive an estimated price from baseline rates
    const rate = BASELINE_RATES[parsed.material_type] ?? BASELINE_RATES['Mixed'] ?? 0.2;
    const estimated_price = Math.max(0, Number((rate * (parsed.estimated_weight_kg || 1)).toFixed(2)));

    return jsonResponse({
      material_type: parsed.material_type ?? 'Unknown',
      title: parsed.title ?? 'Waste item',
      estimated_weight_kg: Number(parsed.estimated_weight_kg) || 1,
      estimated_price,
      confidence: Number(parsed.confidence) || 0,
      notes: parsed.notes ?? '',
    });
  } catch (err) {
    return jsonResponse({ error: (err as Error).message ?? 'Internal error' }, 500);
  }
});

function jsonResponse(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
