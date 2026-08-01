import { GoogleGenAI } from '@google/genai';
import { VercelRequest, VercelResponse } from '@vercel/node';

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
    const { messages, userContext, customSystemPrompt, expertName } = req.body || {};
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Message history is required.' });
    }

    const ai = getAiClient();

    // Map message roles to Gemini expected format: user | model
    const contents = messages.map((m: { role: string; content: string }) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const name = expertName || 'Victoria';
    const defaultSystemInstruction = `You are ${name} ("Ask ${name}"), an empathetic, wise, insightful, and supportive AI relationship expert and psychologist/coach specializing in romantic relationships, dating, effective communication, emotional intimacy, rebuilding trust, conflict resolution, breakup recovery, and establishing healthy personal boundaries.

Core Consultation Guidelines:
1. Respond in clear, warm, engaging, and constructive Portuguese (or match the language if the user writes in another language).
2. Introduce yourself naturally as ${name} when appropriate, providing thoughtful, actionable, and compassionate advice tailored to couples, partners, and individuals seeking relationship growth.
3. Use well-structured paragraphs, bullet points when appropriate, and an encouraging, non-judgmental tone.
4. CRITICAL FORMATTING RULE: Do NOT use markdown bold stars (like **text**) or asterisks (*text*) in your output. Write in natural plain text without asterisks so responses feel completely natural and human.
5. Gently remind users that while you provide expert relationship guidance and communication strategies, you are an AI coach and not a substitute for clinical emergency therapy.
${userContext?.userName ? `User's Name: ${userContext.userName}` : ''}`;

    const systemInstruction = customSystemPrompt && customSystemPrompt.trim() !== ''
      ? `${customSystemPrompt.trim()}\n\nIMPORTANT FORMATTING RULE: Do NOT use markdown bold stars (**text**) or asterisks in output. Write in natural plain text.\n\n${userContext?.userName ? `User's Name: ${userContext.userName}` : ''}`
      : defaultSystemInstruction;

    const candidateModels = ['gemini-3.6-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
    let responseText: string | undefined = undefined;
    let lastError: any = null;

    for (const modelName of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents,
          config: {
            systemInstruction,
            temperature: 0.7,
          },
        });
        if (response.text) {
          responseText = response.text;
          break;
        }
      } catch (mErr: any) {
        lastError = mErr;
        console.warn(`[AI Chat] Model ${modelName} failed, trying next candidate if available...`, mErr?.message || mErr);
      }
    }

    if (!responseText) {
      throw lastError || new Error('No response generated from AI models.');
    }

    const rawReply = responseText || 'Desculpe, não consegui processar uma resposta no momento. Por favor, tente novamente em instantes.';
    const reply = rawReply.replace(/\*\*/g, '');

    return res.status(200).json({
      success: true,
      reply,
    });
  } catch (err: any) {
    console.error('[AI Chat API Error]:', err);

    if (err.message?.includes('GEMINI_API_KEY environment variable is missing')) {
      return res.status(503).json({
        error: 'Gemini API key not configured on the server (GEMINI_API_KEY).',
        missingKey: true
      });
    }

    const isQuotaError = err.status === 'RESOURCE_EXHAUSTED' || 
                         err.status === 429 || 
                         err.message?.includes('429') || 
                         err.message?.includes('quota') || 
                         err.message?.includes('RESOURCE_EXHAUSTED');

    if (isQuotaError) {
      return res.status(429).json({
        error: 'O limite de requisições temporário da IA foi atingido. Por favor, aguarde cerca de 1 minuto e tente novamente.'
      });
    }

    return res.status(500).json({
      error: 'Erro de comunicação com a IA Expert: ' + (err.message || 'Erro desconhecido')
    });
  }
}
