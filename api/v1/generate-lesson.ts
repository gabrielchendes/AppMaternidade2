import { GoogleGenAI } from '@google/genai';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { safeParseAiJson } from '../utils/parseAiJson';
import { generateContentWithRetry } from '../utils/geminiCallWithRetry';

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
      courseTitle,
      moduleTitle,
      lessonTitle,
      lessonGoal,
      aiInstructions,
      action = 'generate',
      existingBlocks = [],
      referenceImage
    } = req.body || {};

    if (!lessonGoal && !aiInstructions && !referenceImage) {
      return res.status(400).json({ error: 'Lesson goal, instructions, or a reference image is required.' });
    }

    const ai = getAiClient();

    const systemInstruction = `You are a World-Class Senior Subject-Matter Specialist, Executive Curriculum Author, Masterclass Architect, and Interactive Learning Engineer.
Your mission is to generate a COMPREHENSIVE, DEEP, HIGH-VALUE MASTERCLASS LESSON in structured JSON.

CRITICAL DIRECTIVES FOR MAXIMUM EXPERTISE & PROFESSIONAL VALUE:
1. DEEP & THOROUGH SPECIALIST CONTENT (NEVER RETURN A SHALLOW OR CHECKLIST-ONLY LESSON):
   - You are strictly forbidden from returning only a bare checklist or a shallow 2-sentence summary!
   - Every generated lesson MUST feel like a $2,000 professional executive masterclass page: packed with modern domain insights, tactical depth, behavioral rationale, structured frameworks, and engaging interactive elements.
   - A complete lesson MUST include 4 to 6 diverse, high-value blocks:
     a) "text" (Executive Framework & Core Insights): Rich HTML-formatted masterclass article with clear headings (<h3>, <h4>), context paragraphs (<p>), highlighted luxury callout boxes (<div class="p-4 bg-emerald-500/10 border-l-4 border-emerald-400 rounded-r-2xl my-4 text-emerald-200"><strong>Strategic Rule:</strong> ...</div>), bullet points (<ul>, <li>), and key principles.
     b) "comparison" (Reactive/Outdated Approach ❌ vs. Strategic Master Protocol ✅): Direct side-by-side contrast revealing common flawed mistakes and the superior evidence-backed method.
     c) "simulator" OR "readiness_evaluator" / "calculator": Interactive decision tree scenario ("What Would You Do?") with nuanced choices and realistic consequences, or a diagnostic assessment with scoring tiers.
     d) "checklist" OR "action_plan": Concrete, phased, high-impact implementation steps where each item includes a clear title AND a thorough description explaining HOW and WHY to execute it.
     e) "reflection": An executive coaching self-diagnostic prompt that encourages the student to apply the lesson's lessons to their exact real-world scenario.
     f) (Optional/Contextual): "tracker" (for streak/habit goals), "ai_analyzer" (for message/text analysis), or "quiz" (for knowledge validation).

2. REFERENCE IMAGE BLUEPRINT (WHEN ATTACHED):
   - When a reference image is provided, treat it as an exact architectural blueprint of the interface. Reconstruct the interactive inputs, counters, graphs, badges, and layout faithful to the image.

3. LANGUAGE MANDATE:
   - ALL generated titles, summaries, HTML text, checklist descriptions, scenario options, and coaching prompts MUST BE WRITTEN IN AMERICAN ENGLISH ("en") BY DEFAULT (unless explicitly requested otherwise).

4. AVAILABLE BLOCK TYPES:
- "text": Core conceptual foundation, masterclass article in rich HTML (using <h3>, <h4>, <p>, <ul>, <li>, <strong>, <em>, <blockquote>, callout <div>).
- "comparison": Side-by-side comparative table / cards (items with "title", "before_text" [❌ Common/Flawed], "after_text" [✅ Elite Strategy]).
- "simulator": Practical scenario decision tree (items with "title", "options", "consequences").
- "readiness_evaluator" or "calculator": Diagnostic scoring test (items with "title", "weight", and "result_tiers").
- "checklist" or "action_plan": Tactical execution steps (items with "title", "description", "category", "required").
- "reflection": Deep coaching journal prompt ("content" and "instructions").
- "quiz": Multiple-choice interactive validation ("title", "options", "correct_option_index", "explanation").
- "tracker": Interactive streak/progress tracker with target days and milestones.
- "ai_analyzer": Text/message temperature diagnostic tool.

MANDATORY JSON OUTPUT FORMAT:
{
  "title": "Lesson Title (IN AMERICAN ENGLISH)",
  "description": "Comprehensive Executive Lesson Summary (IN AMERICAN ENGLISH)",
  "language": "en",
  "duration_minutes": 20,
  "blocks": [
    {
      "id": "block_1",
      "type": "text",
      "title": "Core Methodology & Scientific Breakdown",
      "description": "Foundational principles and real-world behavioral dynamics",
      "content": "<h3>The Core Mechanism</h3><p>Detailed explanation of what drives this dynamic...</p><div class='p-4 bg-emerald-500/10 border-l-4 border-emerald-400 rounded-r-2xl my-4 text-emerald-200'><strong>Key Strategic Rule:</strong> Never react impulsively to short-term fluctuations. Focus on structural boundaries.</div><h4>Critical Behavioral Drivers</h4><ul><li><strong>Primary Driver 1:</strong> Deep explanation...</li><li><strong>Primary Driver 2:</strong> Deep explanation...</li></ul>"
    },
    {
      "id": "block_2",
      "type": "comparison",
      "title": "Outdated Flawed Methods vs. Elite Strategy",
      "description": "Direct comparison to rewire your approach",
      "items": [
        {
          "id": "c1",
          "title": "Emotional Boundary Setting",
          "before_text": "Over-explaining yourself, sending paragraphs to justify your boundaries, seeking external approval.",
          "after_text": "Calm, concise, non-negotiable clarity delivered once with absolute composure."
        }
      ]
    },
    {
      "id": "block_3",
      "type": "simulator",
      "title": "High-Stakes Decision Simulator",
      "description": "Test your strategic instinct in this real-world scenario",
      "items": [
        {
          "id": "s1",
          "title": "Scenario: You receive an ambiguous, high-pressure communication late at night. How do you respond?",
          "options": [
            "Respond immediately to defuse the tension and offer a detailed explanation.",
            "Wait until morning, review your core objectives, and send a calm, structured 2-sentence response.",
            "Ignore completely forever without establishing your boundary."
          ],
          "consequences": {
            "0": "❌ Impulsive reaction signals emotional fragility and invites further boundary erosion.",
            "1": "✅ Optimal strategic composure. Demonstrates high emotional regulation and clear authority.",
            "2": "⚠️ Passive avoidance creates unresolved tension and future miscommunication."
          }
        }
      ]
    },
    {
      "id": "block_4",
      "type": "checklist",
      "title": "Step-by-Step Tactical Protocol",
      "description": "Actionable implementation steps to execute immediately",
      "items": [
        {
          "id": "chk_1",
          "title": "Phase 1: Perform the Immediate Situation Audit",
          "description": "Write down the objective facts without emotional narratives to establish clear baseline data.",
          "category": "Immediate Action",
          "required": true
        },
        {
          "id": "chk_2",
          "title": "Phase 2: Deploy the Calm Response Framework",
          "description": "Craft your boundary using the 3-step structured format taught in this lesson.",
          "category": "Execution",
          "required": true
        }
      ]
    },
    {
      "id": "block_5",
      "type": "reflection",
      "title": "Executive Coaching Diagnostic",
      "description": "Internalize and apply these principles to your personal journey",
      "instructions": "Reflect on your past 3 interactions: where did you compromise your strategic composure, and how will you execute the new protocol moving forward?",
      "placeholder": "Write your detailed reflection and strategic commitments here..."
    }
  ]
}`;

    let promptText = `Requested Action: ${action.toUpperCase()}
Course: ${courseTitle || 'General'}
Module: ${moduleTitle || 'Main Module'}
Suggested Lesson Title: ${lessonTitle || 'Auto-generate engaging title'}
Pedagogical Goal: ${lessonGoal || 'Interactive application'}
Additional Instructions: ${aiInstructions || 'Make it interactive and engaging'}`;

    if (action === 'improve' && existingBlocks && existingBlocks.length > 0) {
      promptText += `\n\nExisting Lesson Blocks to update and improve:\n${JSON.stringify(existingBlocks, null, 2)}`;
    }

    // Build multimodal contents payload if reference image is attached
    const contents: any[] = [];
    if (referenceImage && referenceImage.data) {
      const cleanBase64 = referenceImage.data.replace(/^data:image\/\w+;base64,/, '');
      contents.push({
        inlineData: {
          mimeType: referenceImage.mimeType || 'image/jpeg',
          data: cleanBase64
        }
      });
      promptText += `\n\n[CRITICAL BLUEPRINT MANDATE: A reference image has been attached above. TREAT THIS IMAGE AS A DIRECT VISUAL & STRUCTURAL BLUEPRINT. Reconstruct the exact UI layout, input fields, action buttons, dynamic counters, progress rings, charts, badges, cards, character states/avatars, and interactive sequence shown in the image faithfully. Do NOT simplify this interface into plain text or a checklist!]`;
    }
    contents.push(promptText);

    const candidateModels = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];

    const result = await generateContentWithRetry({
      ai,
      candidateModels,
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
        responseMimeType: 'application/json',
      },
      maxAttemptsPerModel: 2,
      baseDelayMs: 1200,
      logPrefix: '[Generate Lesson API]'
    });

    const responseText = result.text;

    let parsedData: any = null;
    try {
      parsedData = safeParseAiJson(responseText);
    } catch (parseErr) {
      console.error('[Generate Lesson API] Failed to parse JSON:', responseText);
      return res.status(500).json({
        error: 'A IA gerou uma resposta, mas não foi possível formatá-la como JSON estruturado.',
        rawText: responseText
      });
    }

    // POST-GENERATION VALIDATION & FUNCTIONAL ENFORCEMENT LAYER
    const fullTextSearch = `${lessonGoal} ${aiInstructions} ${lessonTitle}`.toLowerCase();
    const isTrackerRequested = /tracker|no\s*-?\s*contact|desafio|challenge|contador|habito|habit|streak|rastreador/.test(fullTextSearch);
    const isCalculatorRequested = /calculadora|calculator|score|pontuação|prontidão|readiness/.test(fullTextSearch);
    const isAnalyzerRequested = /analyzer|análise|mensagem|message|texto|text|ex|sentimento/.test(fullTextSearch);

    if (!parsedData.blocks || !Array.isArray(parsedData.blocks)) {
      parsedData.blocks = [];
    }

    const hasTrackerBlock = parsedData.blocks.some((b: any) => b.type === 'tracker');
    const hasChartBlock = parsedData.blocks.some((b: any) => b.type === 'chart');
    const hasCalculatorBlock = parsedData.blocks.some((b: any) => b.type === 'readiness_evaluator' || b.type === 'calculator');
    const hasAnalyzerBlock = parsedData.blocks.some((b: any) => b.type === 'ai_analyzer');

    const isEnglish = parsedData.language !== 'pt' && parsedData.language !== 'es';

    if (isTrackerRequested && !hasTrackerBlock) {
      parsedData.blocks.push({
        id: `block_auto_tracker_${Date.now()}`,
        type: 'tracker',
        title: isEnglish ? 'No Contact Tracker & Challenge' : 'Rastreador & Desafio No Contact',
        description: isEnglish ? 'Select your start date, track your streak, and log your progress in real time.' : 'Defina a data inicial e acompanhe sua sequência contínua.',
        tracker_label: isEnglish ? 'No Contact Streak Tracker' : 'Rastreador de No Contact',
        tracker_target_days: 30,
        tracker_milestones: [
          { day: 1, title: isEnglish ? 'First Day Defeated' : 'Primeiro Dia Vencido', reward_badge: '🛡️ Courage' },
          { day: 7, title: isEnglish ? '1 Week Milestone' : '1 Semana de Foco', reward_badge: '🔥 Mind Shield' },
          { day: 14, title: isEnglish ? '2 Weeks Clean' : '2 Semanas Limpas', reward_badge: '⚡ High Clarity' },
          { day: 30, title: isEnglish ? '30 Days Freedom' : '30 Dias de Liberdade', reward_badge: '👑 Emotional Freedom' }
        ]
      });
    }

    if (isTrackerRequested && !hasChartBlock) {
      parsedData.blocks.push({
        id: `block_auto_chart_${Date.now()}`,
        type: 'chart',
        title: isEnglish ? 'Dynamic Progress Chart' : 'Gráfico Dinâmico de Progresso',
        description: isEnglish ? 'Real-time visual tracking of your emotional evolution over time.' : 'Acompanhamento visual em tempo real do seu progresso.',
        items: [
          { id: 'c1', title: 'Day 1', day: 'Day 1', weight: 1 },
          { id: 'c2', title: 'Day 7', day: 'Day 7', weight: 7 },
          { id: 'c3', title: 'Day 14', day: 'Day 14', weight: 14 },
          { id: 'c4', title: 'Day 21', day: 'Day 21', weight: 21 },
          { id: 'c5', title: 'Day 30', day: 'Day 30', weight: 30 }
        ]
      });
    }

    if (isCalculatorRequested && !hasCalculatorBlock) {
      parsedData.blocks.push({
        id: `block_auto_calc_${Date.now()}`,
        type: 'readiness_evaluator',
        title: isEnglish ? 'Interactive Readiness Calculator' : 'Calculadora de Prontidão',
        description: isEnglish ? 'Select the statements that apply to calculate your emotional clarity score.' : 'Selecione as afirmações para calcular sua clareza.',
        items: [
          { id: 'rc1', title: isEnglish ? 'I no longer stalk his social media profiles' : 'Não vejo o perfil dele nas redes sociais', weight: 25 },
          { id: 'rc2', title: isEnglish ? 'I can focus on my daily routine without panic' : 'Consigo focar na minha rotina sem pânico', weight: 25 },
          { id: 'rc3', title: isEnglish ? 'I respond strategically rather than impulsively' : 'Respondo de forma estratégica e não impulsiva', weight: 25 },
          { id: 'rc4', title: isEnglish ? 'I prioritize my emotional independence and dignity' : 'Priorizo minha independência emocional e dignidade', weight: 25 }
        ],
        result_tiers: [
          { min_score: 0, max_score: 50, title: isEnglish ? 'Building Foundations' : 'Fase de Fortalecimento', recommendation: isEnglish ? 'Keep following the daily lessons.' : 'Siga as lições diárias.' },
          { min_score: 51, max_score: 100, title: isEnglish ? 'High Emotional Clarity' : 'Alta Clareza Emocional', recommendation: isEnglish ? 'You are ready to advance.' : 'Você está pronta para avançar.' }
        ]
      });
    }

    if (isAnalyzerRequested && !hasAnalyzerBlock) {
      parsedData.blocks.push({
        id: `block_auto_analyzer_${Date.now()}`,
        type: 'ai_analyzer',
        title: isEnglish ? 'AI Message Temperature Analyzer' : 'Analisador de Temperatura da Mensagem por IA',
        description: isEnglish ? 'Paste any text or message received to get an instant AI evaluation.' : 'Cole a mensagem recebida para obter uma avaliação por IA.',
        instructions: isEnglish ? 'Paste the message here for instant diagnosis:' : 'Cole a mensagem aqui para o diagnóstico:',
        placeholder: isEnglish ? 'Ex: "Hey, are you free to talk?"' : 'Ex: "Oi sumida, podemos conversar?"',
        analyzer_type: 'temperature'
      });
    }

    // Ensure IDs for blocks and items while preserving rich block properties
    parsedData.language = parsedData.language || 'en';
    if (parsedData.blocks && Array.isArray(parsedData.blocks)) {
      parsedData.blocks = parsedData.blocks.map((b: any, bIdx: number) => ({
        ...b,
        id: b.id || `block_${Date.now()}_${bIdx}`,
        type: b.type || 'text',
        title: b.title || `Bloco ${bIdx + 1}`,
        description: b.description || '',
        content: b.content || '',
        instructions: b.instructions || '',
        placeholder: b.placeholder || '',
        url: b.url || '',
        analyzer_type: b.analyzer_type || 'temperature',
        analyzer_criteria: b.analyzer_criteria || '',
        tracker_label: b.tracker_label || 'Tracker',
        tracker_target_days: b.tracker_target_days || 30,
        tracker_milestones: Array.isArray(b.tracker_milestones) ? b.tracker_milestones : undefined,
        result_tiers: Array.isArray(b.result_tiers) ? b.result_tiers : undefined,
        items: Array.isArray(b.items)
          ? b.items.map((it: any, itIdx: number) => ({
              ...it,
              id: it.id || `item_${Date.now()}_${bIdx}_${itIdx}`,
              title: it.title || `Item ${itIdx + 1}`,
              description: it.description || '',
              category: it.category || '',
              day: it.day || '',
              required: it.required !== false,
              options: Array.isArray(it.options) ? it.options : undefined,
              correct_option_index: typeof it.correct_option_index === 'number' ? it.correct_option_index : 0,
              explanation: it.explanation || '',
              consequences: it.consequences || undefined,
              weight: typeof it.weight === 'number' ? it.weight : 10,
              before_text: it.before_text || '',
              after_text: it.after_text || ''
            }))
          : undefined
      }));
    }

    return res.status(200).json({
      success: true,
      lesson: parsedData
    });
  } catch (err: any) {
    console.error('[Generate Lesson API Error]:', err);

    const errMsg = err?.message || '';
    const isQuotaError = err.status === 'RESOURCE_EXHAUSTED' || 
                         err.status === 429 || 
                         err.statusCode === 429 ||
                         errMsg.includes('429') || 
                         errMsg.includes('quota') || 
                         errMsg.includes('RESOURCE_EXHAUSTED');

    if (isQuotaError) {
      return res.status(429).json({
        error: 'O limite de requisições de IA foi temporariamente atingido. Aguarde 30 segundos e tente novamente.'
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

    return res.status(500).json({
      error: 'Erro ao gerar aula com IA: ' + (cleanError || 'Erro desconhecido')
    });
  }
}
