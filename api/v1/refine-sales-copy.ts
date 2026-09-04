import { GoogleGenAI } from '@google/genai';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { safeParseAiJson } from '../_utils/parseAiJson';
import { generateContentWithRetry } from '../_utils/geminiCallWithRetry';

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
      currentHtml,
      userInstruction,
      courseTitle,
      targetAudience,
      tone = 'empathetic_persuasive'
    } = req.body || {};

    if (!userInstruction) {
      return res.status(400).json({ error: 'Instruction is required for sales page refinement.' });
    }

    const ai = getAiClient();

    const systemInstruction = `You are an Elite Direct Response Copywriter, Conversion Rate Optimization (CRO) Architect, and Master HTML/Tailwind Designer.

Your task is to refine, upgrade, rewrite, or expand the provided HTML Sales Page copy according to the user's specific request.

CRITICAL DESIGN & CODING RULES:
1. OUTPUT FORMAT:
   - Return ONLY a valid JSON object matching:
     {
       "refinedHtml": "<div class='space-y-8 text-gray-200'>...updated full sales page HTML content...</div>",
       "summaryOfChanges": "Concise summary of what was enhanced in English"
     }
2. LANGUAGE:
   - Must be written in natural, persuasive, high-converting American English (en-US).
3. DESIGN SYSTEM:
   - Use clean, modern Tailwind CSS classes and semantic HTML tags.
   - Use elevated cards (<div class="p-6 rounded-2xl bg-zinc-900/70 border border-white/10 shadow-xl">), crisp typography (<h2 class="text-2xl font-black tracking-tight text-white mb-4">), callout containers with left borders (<div class="p-5 rounded-2xl bg-emerald-500/10 border-l-4 border-emerald-400 text-emerald-200">), and elegant objection-handling accordions/lists.
   - NEVER output markdown code fences inside the JSON values. Only valid HTML.`;

    const userPrompt = `Course Title: ${courseTitle || 'Mastery Course'}
Target Audience: ${targetAudience || 'Families and ambitious individuals'}
Tone: ${tone}

USER REFINEMENT INSTRUCTION:
"${userInstruction}"

CURRENT HTML SALES PAGE CONTENT:
${currentHtml || '<div class="space-y-6 text-gray-200"><h3>Mastery Transformation</h3><p>Discover the complete protocol...</p></div>'}

Apply the user's instruction precisely, keeping the overall structure cohesive, luxurious, and ultra-high-converting.`;

    const candidateModels = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];

    const result = await generateContentWithRetry({
      ai,
      candidateModels,
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction,
        temperature: 0.6,
        responseMimeType: 'application/json'
      },
      maxAttemptsPerModel: 2,
      baseDelayMs: 1200,
      logPrefix: '[refine-sales-copy]'
    });

    const textResult = result.text;

    const parsed = safeParseAiJson(textResult);

    return res.status(200).json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('[refine-sales-copy] Error:', error);

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

    return res.status(500).json({ error: cleanError || 'Error refining sales copy with AI' });
  }
}
