import { GoogleGenAI } from '@google/genai';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { safeParseAiJson } from '../../src/serverUtils/parseAiJson';
import { generateContentWithRetry } from '../../src/serverUtils/geminiCallWithRetry';

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
      scope = 'course', // 'course' | 'module' | 'chapter' | 'element'
      instruction,
      currentData,
      parentContext = {},
      language = 'en'
    } = req.body || {};

    if (!instruction || !instruction.trim()) {
      return res.status(400).json({ error: 'An edit instruction is required.' });
    }

    if (!currentData) {
      return res.status(400).json({ error: 'Current data to modify is required.' });
    }

    const ai = getAiClient();
    const candidateModels = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];

    const systemInstruction = `You are a World-Class Precision Course Editor, Curriculum Refiner, and Direct Response Copywriting Specialist.
Your task is to modify the provided course element according to the user's explicit instruction.

CRITICAL PRECISION RULES:
1. TARGETED SURGICAL EDITING:
   - Alter ONLY what was requested in the instruction.
   - Strictly preserve all other fields, keys, IDs, and structure.
   - Do NOT delete or truncate content that was not mentioned.
2. HIGH PEDAGOGICAL & CRO VALUE:
   - When asked to add or enhance interactive elements, use rich, valid block structures:
     - "tracker" (Habit, streak, no-contact counter with milestones and SOS button)
     - "ai_analyzer" (Text/message temperature and sentiment analysis)
     - "simulator" (Decision tree scenario with choices and consequences)
     - "readiness_evaluator" or "calculator" (Diagnostic questions with weights and tiered recommendations)
     - "action_plan" or "checklist" (Tactical step-by-step items)
     - "comparison" (Reactive approach vs Strategic protocol)
     - "reflection" (Executive diagnostic journal prompt)
     - "quiz" (Multiple-choice validation with explanations)
     - "text" (Rich masterclass HTML)
3. LANGUAGE CONSISTENCY:
   - Keep all generated or modified text in the course language (${language === 'pt-BR' ? 'Portuguese (Brazil)' : 'American English'}) unless instructed otherwise.
4. JSON OUTPUT:
   - Return ONLY a valid JSON object matching the exact structure of the input entity with the applied modifications.`;

    const userPrompt = `Target Scope: ${scope}
User Edit Instruction: "${instruction}"

Parent Context (if relevant):
${JSON.stringify(parentContext, null, 2)}

Current Data to Modify:
${JSON.stringify(currentData, null, 2)}

Apply the requested changes and return ONLY the updated data as valid JSON.`;

    const result = await generateContentWithRetry({
      ai,
      candidateModels,
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction,
        temperature: 0.5,
        responseMimeType: 'application/json',
      },
      maxAttemptsPerModel: 2,
      baseDelayMs: 1200,
      logPrefix: '[AI Course Editor API]'
    });

    const responseText = result.text;

    let parsedResult: any = null;
    try {
      parsedResult = safeParseAiJson(responseText);
    } catch (parseErr) {
      console.error('[AI Course Editor API] Failed to parse JSON:', responseText.slice(0, 500));
      return res.status(500).json({
        error: 'The AI modified the content, but the response could not be parsed as valid JSON.',
        rawText: responseText
      });
    }

    return res.status(200).json({
      success: true,
      modifiedData: parsedResult,
      scope,
      appliedInstruction: instruction
    });

  } catch (error: any) {
    console.error('[AI Course Editor API] Error:', error);
    return res.status(500).json({
      error: error.message || 'Internal server error while editing with AI'
    });
  }
}
