import { createClient } from 'npm:@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY') ?? '';
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

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

const VALID_MATERIALS = [
  'Plastic PET', 'Plastic HDPE', 'Plastic', 'Cardboard', 'Paper', 'Aluminum',
  'Steel', 'Glass', 'Electronics', 'Organic', 'Textile', 'Wood', 'Mixed', 'Unknown',
];

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
    const { description } = body as { description?: string };
    if (!description || !description.trim()) {
      return jsonResponse({ error: 'description is required' }, 400);
    }

    if (!GROQ_API_KEY) {
      return jsonResponse({ error: 'Groq API key not configured. Add GROQ_API_KEY as an edge function secret.' }, 500);
    }

    const systemPrompt = `You are a waste-classification assistant for a recycling marketplace.
The user will describe a waste item in plain language.
Respond ONLY with a JSON object (no markdown, no prose) with these exact fields:
{
  "material_type": one of ${JSON.stringify(VALID_MATERIALS)},
  "title": a short descriptive title for the listing (max 60 chars),
  "estimated_weight_kg": a positive number estimating the weight in kg based on the description,
  "confidence": a number between 0 and 1 indicating classification confidence,
  "notes": a one-sentence note about condition or handling
}`;

    const groqRes = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: description },
        ],
        temperature: 0.2,
        max_tokens: 400,
        response_format: { type: 'json_object' },
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      return jsonResponse({ error: `Groq API error (${groqRes.status}): ${errText}` }, 502);
    }

    const groqJson = await groqRes.json();
    const text: string | undefined = groqJson?.choices?.[0]?.message?.content;
    if (!text) {
      return jsonResponse({ error: 'Groq returned no content' }, 502);
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
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return jsonResponse({ error: 'Could not parse Groq response as JSON' }, 502);
      parsed = JSON.parse(match[0]);
    }

    // Normalize material type
    let materialType = parsed.material_type ?? 'Unknown';
    if (!VALID_MATERIALS.includes(materialType)) {
      materialType = 'Unknown';
    }

    // Derive an estimated price from baseline rates
    const rate = BASELINE_RATES[materialType] ?? 0.2;
    const estimated_price = Math.max(0, Number((rate * (parsed.estimated_weight_kg || 1)).toFixed(2)));

    return jsonResponse({
      material_type: materialType,
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
