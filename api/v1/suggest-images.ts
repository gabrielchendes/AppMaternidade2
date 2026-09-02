import { GoogleGenAI } from '@google/genai';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { safeParseAiJson } from '../utils/parseAiJson';

let aiInstance: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is missing');
  }
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiInstance;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const {
      topic,
      targetAudience = 'Modern learners and professionals',
      contextType = 'course_cover', // 'course_cover' | 'lesson_illustration' | 'sales_hero'
      stylePreference = 'editorial_minimalist' // 'editorial_minimalist' | 'warm_cinematic' | 'hyper_realistic'
    } = req.body || {};

    if (!topic) {
      return res.status(400).json({ error: 'Topic or context is required for image suggestions.' });
    }

    const ai = getAiClient();

    const systemInstruction = `You are an Award-Winning Creative Art Director, Editorial Photographer, and Prompt Engineering Specialist for luxury branding and premium edtech digital products.

Your goal is to analyze the given topic and context, and generate comprehensive, ultra-high-converting visual suggestions:
1. Production-ready AI generation prompts for Midjourney v6, DALL-E 3, and Flux 1.1 Pro (with camera gear, lighting, color science, composition rules, and aspect ratios).
2. Curated keywords and direct search queries for royalty-free photography platforms (Unsplash, Pexels).
3. Creative art direction notes (color palette hex codes, mood, visual metaphors to avoid clichés).

CRITICAL DIRECTIVES:
- No AI clichés: Avoid plastic doll faces, oversaturated neon gradients, cheesy corporate handshakes, or robotic generic stock poses.
- Focus on authentic emotion, refined luxury minimalism, editorial magazine lighting (soft directional morning light, Hasselblad medium format depth, 85mm f/1.4 lens, natural grain).
- All prompt outputs MUST be in natural, professional English.

Return ONLY a valid JSON object matching this exact schema:
{
  "conceptTitle": "Short poetic concept title in English",
  "artDirectionSummary": "2-sentence creative rationale explaining the visual metaphor",
  "recommendedColorPalette": [
    { "name": "Deep Slate", "hex": "#1E293B" },
    { "name": "Warm Champagne", "hex": "#F5E6D3" },
    { "name": "Sage Emerald", "hex": "#10B981" },
    { "name": "Soft Cream", "hex": "#FAF8F5" }
  ],
  "prompts": {
    "midjourney": "Detailed Midjourney v6 prompt with --ar 16:9 --style raw --v 6.0 --q 2 parameters",
    "dalle3": "Detailed DALL-E 3 prompt with exact camera framing, subject emotion, and natural lighting cues",
    "flux": "Detailed Flux 1.1 Pro prompt with photorealistic texture, shallow depth of field, and 35mm film grain"
  },
  "stockSearchKeywords": ["keyword 1", "keyword 2", "keyword 3", "keyword 4"],
  "stockLinks": {
    "unsplash": "https://unsplash.com/s/photos/encoded-query",
    "pexels": "https://www.pexels.com/search/encoded-query"
  },
  "suggestedPlaceholderUrls": [
    "https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80"
  ]
}`;

    const userPrompt = `Generate premium visual image suggestions and AI prompts for:
Topic: "${topic}"
Audience: "${targetAudience}"
Asset Type: "${contextType}"
Visual Style: "${stylePreference}"

Generate output in strict JSON format.`;

    const candidateModels = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'];
    let textResult = '';
    let lastError: any = null;

    for (const modelName of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          config: {
            systemInstruction,
            temperature: 0.6,
            responseMimeType: 'application/json'
          }
        });
        if (response && response.text) {
          textResult = response.text;
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[suggest-images] Error with model ${modelName}:`, err?.message || err);
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
    }

    if (!textResult) {
      throw lastError || new Error('Unable to generate image suggestions with available AI models.');
    }

    const parsed = safeParseAiJson(textResult);

    // Ensure links are safely encoded
    const primaryQuery = parsed.stockSearchKeywords?.[0] || topic;
    const encodedQuery = encodeURIComponent(primaryQuery);
    parsed.stockLinks = {
      unsplash: `https://unsplash.com/s/photos/${encodedQuery}`,
      pexels: `https://www.pexels.com/search/${encodedQuery}`
    };

    return res.status(200).json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('[suggest-images] Error:', error);

    const errMsg = error?.message || '';
    if (errMsg.includes('503') || errMsg.includes('UNAVAILABLE') || errMsg.includes('high demand')) {
      return res.status(503).json({
        error: 'Os servidores de IA estão com alta demanda temporária. Aguarde alguns segundos e tente novamente.'
      });
    }

    let cleanError = errMsg;
    try {
      if (errMsg.includes('{') && errMsg.includes('}')) {
        const jsonStart = errMsg.indexOf('{');
        const jsonEnd = errMsg.lastIndexOf('}');
        const candidateJson = errMsg.slice(jsonStart, jsonEnd + 1);
        const parsed = JSON.parse(candidateJson);
        if (parsed.error?.message) {
          cleanError = parsed.error.message;
        }
      }
    } catch (_) {}

    return res.status(500).json({ error: cleanError || 'Error generating image suggestions with AI' });
  }
}
