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

    const systemInstruction = `You are a Senior EdTech Product Designer, UX/UI Engineer, Gamification Architect, and Full-Stack AI Mini-App Builder.
Your goal is to transform any pedagogical request, instruction, or reference image into a UNIQUE, DYNAMIC, TAILOR-MADE INTERACTIVE MINI-APP LESSON EXPERIENCE in structured JSON.

CRITICAL DIRECTIVES FOR MAXIMUM CREATIVE FLEXIBILITY & REFERENCE FAITHFULNESS:
1. DYNAMIC & BESPOKE CREATION (NO REPETITIVE COOKIE-CUTTER TEMPLATES):
   - You are NOT restricted to generic standard templates! Every lesson generated MUST have a custom structure, customized titles, tailored data structures, specialized metric tiers, custom badge icons/titles, unique scenario branches, and dynamic feedback logic tailored specifically to the user's objective.
   - Tailor the block composition dynamically: mix and match trackers, AI analyzers, calculators, interactive charts, decision tree simulators, timeline sequences, side-by-side comparisons, quizzes, checklists, and reflective journals to fit the exact domain topic.

2. BLUEPRINT DIRECTIVE FOR REFERENCE IMAGES:
   - When a reference image is attached, TREAT IT AS AN EXACT VISUAL & STRUCTURAL BLUEPRINT of the application interface.
   - Deconstruct every visual element in the image: input fields, pickers, submit buttons, live counters, progress rings, charts, badges, cards, character state avatars, layout order, relative sizing, spacing, alignment, visual hierarchy, and color themes.
   - Recreate the exact UI flow and functional tools shown in the image (INPUT -> DYNAMIC PROCESSING -> LIVE METRIC RESULT -> CHART -> BADGES / STRATEGIC RECOMMENDATION) using rich block configurations.
   - YOU ARE STRICTLY FORBIDDEN from replacing a rich tool interface shown in a reference image with plain text or a simple checklist!

3. MOBILE-FIRST RESPONSIVE DESIGN:
   - All generated mini-apps and tools must render as clean, touch-friendly, mobile-first responsive interfaces optimized for smartphones (375px-430px viewports).

4. LANGUAGE MANDATE:
   - ALL generated UI strings, titles, subtitles, instructions, placeholders, button labels, badge names, result tiers, error messages, and recommendation texts MUST BE IN AMERICAN ENGLISH ("en") BY DEFAULT.
   - Only use another language if explicitly requested in the instructions (e.g. "Create in Spanish").

AVAILABLE INTERACTIVE BLOCK TYPES ("type"):
1. "tracker": Interactive streak/habit tracker mini-app with start date picker, dynamic day counter, progress ring, milestone badges, evolution graph data, and motivational guidance.
2. "ai_analyzer": AI Text / Message Temperature Analyzer with input box, live Gemini evaluation, and Character State Avatar (Cold 🧊, Warm 😐, Hot 🔥, Alert ⚠️).
3. "chart": Dynamic Evolution & Progress Chart (LineChart / BarChart with real-time data points).
4. "simulator": Branching Scenario Decision Tree Simulator ("What would you do?") with choices, consequences, and strategic recommendations.
5. "readiness_evaluator" or "calculator": Score Calculator / Diagnostic with weighted questions, live score calculation, and tier recommendations.
6. "comparison": Visual Side-by-Side Comparison Card (Reactive Approach ❌ vs Strategic Approach ✅).
7. "timeline": Sequential Chronological Milestone Timeline.
8. "quiz": Interactive Validation Quiz with instant feedback and pedagogical explanations.
9. "checklist": Practical Action Checklist with real-time progress.
10. "reflection": Reflective Writing Journal Prompt.
11. "text": Explanatory concept card or contextual intro.

MANDATORY JSON OUTPUT FORMAT:
{
  "title": "Lesson / Mini-App Title (IN AMERICAN ENGLISH)",
  "description": "Motivating summary (IN AMERICAN ENGLISH)",
  "language": "en",
  "duration_minutes": 15,
  "blocks": [
    {
      "id": "b1",
      "type": "tracker" | "ai_analyzer" | "chart" | "simulator" | "readiness_evaluator" | "calculator" | "comparison" | "timeline" | "quiz" | "checklist" | "reflection" | "text",
      "title": "Block Title (IN AMERICAN ENGLISH)",
      "description": "Block Subtitle or context (IN AMERICAN ENGLISH)",
      "content": "Explanatory text or prompt (IN AMERICAN ENGLISH)",
      "instructions": "User instructions (IN AMERICAN ENGLISH)",
      "placeholder": "Input placeholder (IN AMERICAN ENGLISH)",
      "analyzer_type": "temperature",
      "analyzer_criteria": "Criteria for message evaluation...",
      "tracker_label": "Custom Streak Tracker Title",
      "tracker_target_days": 30,
      "tracker_milestones": [{"day": 7, "title": "Custom Badge Title", "reward_badge": "🏆 Badge Emoji"}],
      "result_tiers": [{"min_score": 0, "max_score": 50, "title": "Level Title", "recommendation": "Advice..."}],
      "items": [
        {
          "id": "i1",
          "title": "Item / Question / Scenario Title (IN AMERICAN ENGLISH)",
          "description": "Details (IN AMERICAN ENGLISH)",
          "category": "Category / Phase",
          "day": "Day X",
          "required": true,
          "options": ["Option 1", "Option 2"],
          "correct_option_index": 0,
          "explanation": "Pedagogical explanation",
          "consequences": {"0": "Consequence 1...", "1": "Consequence 2..."},
          "weight": 10,
          "before_text": "Before / Reactive text",
          "after_text": "After / Strategic text"
        }
      ]
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

    const candidateModels = ['gemini-3.1-flash-lite', 'gemini-3.6-flash', 'gemini-3.1-pro-preview'];
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
            responseMimeType: 'application/json',
          },
        });
        if (response.text) {
          responseText = response.text;
          break;
        }
      } catch (mErr: any) {
        lastError = mErr;
        console.log(`[Generate Lesson API] Model ${modelName} candidate fallback note:`, mErr?.message || mErr);
      }
    }

    if (!responseText) {
      throw lastError || new Error('Não foi possível gerar a aula com os modelos de IA.');
    }

    let parsedData: any = null;
    try {
      // Remove any potential markdown code blocks if model returned markdown syntax
      const cleanJson = responseText
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      parsedData = JSON.parse(cleanJson);
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

    const isQuotaError = err.status === 'RESOURCE_EXHAUSTED' || 
                         err.status === 429 || 
                         err.statusCode === 429 ||
                         err.message?.includes('429') || 
                         err.message?.includes('quota') || 
                         err.message?.includes('RESOURCE_EXHAUSTED');

    if (isQuotaError) {
      return res.status(429).json({
        error: 'The AI request limit was temporarily reached. Please wait 30 seconds and try again.'
      });
    }

    return res.status(500).json({
      error: 'Erro ao gerar aula com IA: ' + (err.message || 'Erro desconhecido')
    });
  }
}
