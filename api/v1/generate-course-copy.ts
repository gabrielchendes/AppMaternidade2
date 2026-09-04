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
      topicOrTitle,
      targetAudience,
      mainPainOrDesire,
      priceTier = 97,
      currency = 'USD',
      tone = 'empathetic_persuasive',
      language = 'en',
      includeOldPrice = false,
      oldPriceTier,
      existingCourse = null
    } = req.body || {};

    if (!topicOrTitle && !mainPainOrDesire) {
      return res.status(400).json({ error: 'Topic or main pain point is required.' });
    }

    const ai = getAiClient();

    const targetPriceCents = Math.round(Number(priceTier) * 100) || 9700;
    const targetOldPriceCents = includeOldPrice
      ? (oldPriceTier ? Math.round(Number(oldPriceTier) * 100) : Math.round(Number(priceTier) * 2.8) * 100)
      : 0;

    const systemInstruction = `You are a World-Class Direct Response Copywriter, Neuro-Copywriting Master, and Conversion Rate Optimization (CRO) Lead for Premium EdTech and Global Self-Evolution / Maternal / High-Performance Infoproducts.

Your goal is to generate HIGH-CONVERTING course marketing copywriting, card previews, and a comprehensive sales page layout based on Eugene Schwartz's 5 Levels of Awareness, Cialdini's Persuasion Principles, and modern aesthetic Direct Response frameworks.

CRITICAL DIRECTIVES:
1. STRICT LANGUAGE REQUIREMENT:
   - ALL generated copy, titles, subtitles, descriptions, bullet benefits, badge texts, CTA buttons, guarantee details, payment assurances, sales preview HTML, suggested module names, and suggested chapter titles MUST BE WRITTEN IN NATURAL, HIGH-CONVERTING AMERICAN ENGLISH (en-US).
   - Never output Portuguese, Spanish or mixed languages unless the user explicitly commands a non-English language in their prompt.

2. PRICING & PROMOTION LOGIC:
   ${includeOldPrice ? `
   - PROMOTIONAL OFFER IS ENABLED: Include 'old_price' (${targetOldPriceCents}) and generate a compelling 'offer_badge_text' (e.g., "SPECIAL OFFER • 65% OFF", "LIMITED TIME DISCOUNT", or "FOUNDERS LAUNCH SPECIAL").
   ` : `
   - PROMOTIONAL OFFER IS DISABLED: Set 'old_price' to 0. Set 'offer_badge_text' to an EMPTY STRING (""). Do NOT include any fake discounts, strikethrough prices, or percentage-off claims. Present the course at its clean, authoritative standard price.
   `}

3. MAXIMAL CONVERSION RATE OPTIMIZATION (CRO):
   - Write magnetic, emotional, clear, and action-oriented copy.
   - Use high-converting hooks, clear tangible benefits (deliverables), powerful risk-reversal guarantees, and compelling CTA buttons.
   - Blend genuine empathy and inspiration with undeniable authority, prestige, and practical relief.

4. STRUCTURED OUTPUT FORMAT:
   You MUST return ONLY a raw valid JSON object strictly matching this schema with NO markdown code fences and NO commentary before or after:
   {
     "title": "Short, memorable, impactful course name in English",
     "subtitle": "Magnetic sub-headline with core promise/transformation in English",
     "description": "Compelling 2-3 sentence overview for cards and summaries in English",
     "price": ${targetPriceCents},
     "old_price": ${targetOldPriceCents},
     "benefits": [
       "Tangible Deliverable 1 with clear benefit",
       "Tangible Deliverable 2 with clear benefit",
       "Tangible Deliverable 3 with clear benefit",
       "Tangible Deliverable 4 with clear benefit",
       "Tangible Deliverable 5 with clear benefit"
     ],
     "cta_text": "UNLOCK ACCESS NOW",
     "premium_badge_text": "EXCLUSIVE METHOD",
     "offer_badge_text": "${includeOldPrice ? 'SPECIAL OFFER • 65% OFF' : ''}",
     "lifetime_badge_text": "LIFETIME ACCESS",
     "social_proof": "+3,480 active students transformed",
     "payment_label_text": "Secure Checkout",
     "secure_payment_label": "100% Encrypted & Safe",
     "instant_access_label": "Instant Access in Your Email",
     "preview_enabled": true,
     "preview_type": "text",
     "preview_title": "Headline of the Sales Preview Page in English",
     "preview_subtitle": "Hook & sub-headline explaining the breakthrough in English",
     "preview_rating": "4.9 ⭐ (980+ verified reviews)",
     "preview_students_label": "+2,850 Active Students",
     "preview_guarantee_label": "7-Day Money-Back Guarantee",
     "preview_support_vip_label": "VIP Expert Support",
     "preview_bonus_title": "Exclusive Bonuses Included Today",
     "preview_modules_label": "Curriculum & Method Modules",
     "preview_students_tag": "Instant & Lifetime Access",
     "preview_risk_zero_label": "100% Zero Risk for You",
     "preview_guarantee_title": "100% Risk-Free 7-Day Guarantee",
     "preview_guarantee_subtitle": "Full refund with a single click if you're not completely thrilled.",
     "preview_guarantee_description": "You have a full 7 days to explore the course, watch the lessons, and apply the step-by-step techniques. If for any reason you feel it hasn't exceeded your expectations, simply request a refund to receive 100% of your money back.",
     "preview_footer_cta": "${includeOldPrice ? 'GET INSTANT ACCESS WITH DISCOUNT' : 'GET INSTANT ACCESS NOW'}",
     "preview_text": "PREVIEW COURSE",
     "preview_rich_text": "<div class='space-y-6 text-gray-200'>... A beautiful, well-spaced, highly persuasive HTML sales letter with headings, bullet points, problem vs solution breakdown, modules overview, and trust badges written in English ...</div>",
     "suggestedModules": [
       {
         "title": "Module 1: Foundations & Initial Assessment",
         "chapters": [
           { "title": "Lesson 1: The Root Cause Breakdown", "description": "Understanding what is actually holding you back.", "duration_minutes": 15, "content_type": "interactive" },
           { "title": "Lesson 2: The 3 Critical Mistakes to Avoid", "description": "How to immediately halt the cycle of frustration.", "duration_minutes": 20, "content_type": "interactive" }
         ]
       },
       {
         "title": "Module 2: The Step-by-Step Implementation Framework",
         "chapters": [
           { "title": "Lesson 1: The Immediate Action Plan", "description": "Applying the practical core framework today.", "duration_minutes": 25, "content_type": "interactive" },
           { "title": "Lesson 2: Handling Setbacks with Confidence", "description": "Maintaining consistency and long-term results.", "duration_minutes": 18, "content_type": "interactive" }
         ]
       }
     ]
   }`;

    const userPrompt = `Generate maximum-conversion course details and sales preview page IN AMERICAN ENGLISH:
Topic / Title: ${topicOrTitle || 'N/A'}
Target Audience: ${targetAudience || 'Families and individuals seeking actionable, high-impact evolution'}
Main Pain / Desire: ${mainPainOrDesire || 'Overcoming exhaustion, confusion, and inconsistency with a proven framework'}
Target Price: $ ${priceTier}
Promotional Old Price: ${includeOldPrice ? `$ ${oldPriceTier || Math.round(Number(priceTier) * 2.8)} (Promotional discount active)` : 'DISABLED (No old price, no promotional discount badge)'}
Tone: ${tone}
${existingCourse ? `Existing Course Data to Enhance:\n${JSON.stringify(existingCourse, null, 2)}` : ''}

Generate the complete high-converting copy in valid JSON. All text must be in American English.`;

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
      logPrefix: '[generate-course-copy]'
    });

    const textResult = result.text;

    const parsed = safeParseAiJson(textResult);

    if (!includeOldPrice) {
      parsed.old_price = 0;
      parsed.offer_badge_text = '';
    }

    return res.status(200).json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('[generate-course-copy] Error:', error);

    const errMsg = error?.message || '';
    const isQuotaError = error.status === 'RESOURCE_EXHAUSTED' || 
                         error.status === 429 || 
                         error.statusCode === 429 ||
                         errMsg.includes('429') || 
                         errMsg.includes('quota') || 
                         errMsg.includes('RESOURCE_EXHAUSTED');

    if (isQuotaError) {
      return res.status(429).json({
        error: 'O limite temporário de requisições da IA foi atingido. Por favor, aguarde alguns segundos e tente novamente.'
      });
    }

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

    return res.status(500).json({ error: cleanError || 'Erro interno ao gerar a copy com IA' });
  }
}
