import { createClient } from 'npm:@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

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
  'Mixed': 0.15, // Added missing material key
};

interface GeminiPayload {
  material_type?: string;
  title?: string;
  estimated_weight_kg?: number | string;
  confidence?: number | string;
  notes?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      return jsonResponse({ error: 'Missing authorization token' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return jsonResponse({ error: 'Invalid or expired session' }, 401);
    }

    let body: { imageBase64?: string; mimeType?: string };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    const { imageBase64, mimeType } = body;
    if (!imageBase64 || !mimeType) {
      return jsonResponse({ error: 'imageBase64 and mimeType are required' }, 400);
    }

    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) {
      return jsonResponse({ error: 'Gemini API key not configured.' }, 500);
    }

    // Strip Data URL prefix if present
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const prompt = `You are a waste-classification assistant for a recycling marketplace.
Analyze this image of waste material and respond ONLY with a JSON object (no markdown, no prose) with these exact fields:
{
  "material_type": one of ["Plastic PET","Plastic HDPE","Plastic","Cardboard","Paper","Aluminum","Steel","Glass","Electronics","Organic","Textile","Wood","Mixed","Unknown"],
  "title": a short descriptive title for the listing (max 60 chars),
  "estimated_weight_kg": a positive number estimating the weight in kg,
  "confidence": a number between 0 and 1 indicating classification confidence,
  "notes": a one-sentence note about condition or handling
}`;

    const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;

    const geminiRes = await fetch(geminiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType, data: cleanBase64 } },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 400,
          responseMimeType: 'application/json',
        },
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

    let parsed: GeminiPayload = {};
    try {
      const rawText = text.replace(/```json|```/g, '').trim();
      const match = rawText.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(match ? match[0] : rawText);
    } catch {
      return jsonResponse({ error: 'Could not parse Gemini response as valid JSON' }, 502);
    }

    // Safe number parsing
    const rawWeight = typeof parsed.estimated_weight_kg === 'number'
      ? parsed.estimated_weight_kg
      : parseFloat(String(parsed.estimated_weight_kg ?? '1'));
    const estimated_weight_kg = !isNaN(rawWeight) && rawWeight > 0 ? rawWeight : 1;

    const rawConfidence = typeof parsed.confidence === 'number'
      ? parsed.confidence
      : parseFloat(String(parsed.confidence ?? '0'));
    const confidence = !isNaN(rawConfidence) ? Math.min(Math.max(rawConfidence, 0), 1) : 0;

    const materialType = parsed.material_type ?? 'Unknown';
    const rate = BASELINE_RATES[materialType] ?? BASELINE_RATES['Mixed'] ?? 0.2;
    const estimated_price = Math.max(0, Number((rate * estimated_weight_kg).toFixed(2)));

    return jsonResponse({
      material_type: materialType,
      title: parsed.title ?? 'Waste item',
      estimated_weight_kg,
      estimated_price,
      confidence,
      notes: parsed.notes ?? '',
    });
  } catch (err) {
    return jsonResponse({ error: (err as Error).message ?? 'Internal server error' }, 500);
  }
});

function jsonResponse(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}