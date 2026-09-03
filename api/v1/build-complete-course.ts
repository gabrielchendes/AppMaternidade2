import { GoogleGenAI } from '@google/genai';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { safeParseAiJson } from '../utils/parseAiJson';
import { generateContentWithRetry, isRetryableGeminiError } from '../utils/geminiCallWithRetry';

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

// Curated high-resolution thematic photographic visual covers
const THEMATIC_VISUAL_ASSETS: Record<string, string[]> = {
  relationship: [
    'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1518199266791-5375a83190b7?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1494774157365-9e04c6720e47?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1200&q=80',
  ],
  coaching_mindset: [
    'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1499209974431-9dddcece7f88?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1493612276216-ee3925520721?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80',
  ],
  maternal_health: [
    'https://images.unsplash.com/photo-1555252333-9f8e92e65ee9?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1516627145497-ae6968895b74?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1544717302-de2939b7ef71?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&w=1200&q=80',
  ],
  default: [
    'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=1200&q=80',
  ]
};

function selectThematicCovers(topic: string, count: number): string[] {
  const t = topic.toLowerCase();
  let pool = THEMATIC_VISUAL_ASSETS.default;

  if (t.includes('ex') || t.includes('breakup') || t.includes('attraction') || t.includes('love') || t.includes('relat') || t.includes('couple') || t.includes('dating') || t.includes('marriage')) {
    pool = THEMATIC_VISUAL_ASSETS.relationship;
  } else if (t.includes('mother') || t.includes('baby') || t.includes('matern') || t.includes('parent') || t.includes('family') || t.includes('child')) {
    pool = THEMATIC_VISUAL_ASSETS.maternal_health;
  } else if (t.includes('mind') || t.includes('confiden') || t.includes('psychol') || t.includes('habit') || t.includes('leader') || t.includes('career') || t.includes('success')) {
    pool = THEMATIC_VISUAL_ASSETS.coaching_mindset;
  }

  const results: string[] = [];
  for (let i = 0; i < count; i++) {
    results.push(pool[i % pool.length]);
  }
  return results;
}

/**
 * Robust fallback generator that guarantees a complete, high-value, pedagogically
 * structured course if upstream AI models experience prolonged service unavailability (503).
 */
function buildResilientFallbackCourse(params: {
  command: string;
  language: string;
  priceTier: number;
  includeOldPrice?: boolean;
  tone?: string;
  targetAudience?: string;
}) {
  const { command, language, priceTier, includeOldPrice = true, targetAudience } = params;
  const isPt = language === 'pt-BR' || language === 'pt';
  const targetPriceCents = Math.round(Number(priceTier) * 100) || 9700;
  const targetOldPriceCents = includeOldPrice ? Math.round(targetPriceCents * 2) : 0;

  // Derive a clean, impactful course title from command
  const cleanTopic = command.trim().replace(/^crie\s+um\s+curso\s+(sobre\s+|de\s+)?/i, '').replace(/^create\s+a\s+course\s+(about\s+|on\s+)?/i, '');
  const capitalizedTopic = cleanTopic.charAt(0).toUpperCase() + cleanTopic.slice(1);

  const title = isPt
    ? `Protocolo de Maestria: ${capitalizedTopic}`
    : `Mastery Protocol: ${capitalizedTopic}`;

  const subtitle = isPt
    ? `O método prático, estratégico e comportamental para dominar ${cleanTopic} com clareza e autoridade.`
    : `The practical, strategic, and behavioral protocol to master ${cleanTopic} with clarity and authority.`;

  const description = isPt
    ? `Um programa de transformação executivo desenvolvido para guiar você passo a passo através de dinâmicas práticas, rastreadores funcionais, simuladores de decisão e diagnósticos comportamentais.`
    : `An executive transformation curriculum engineered to guide you step-by-step through actionable frameworks, interactive trackers, scenario simulators, and behavioral diagnostics.`;

  const course = {
    title,
    subtitle,
    description,
    price: targetPriceCents,
    old_price: targetOldPriceCents,
    category: isPt ? 'Desenvolvimento & Relações' : 'Development & Relationships',
    level: isPt ? 'Formação Completa / Masterclass' : 'Complete Masterclass',
    estimated_duration: isPt ? '4 a 6 Semanas (No seu ritmo)' : '4 to 6 Weeks (Self-Paced)',
    target_audience: targetAudience || (isPt ? 'Pessoas comprometidas com uma mudança prática e duradoura' : 'Individuals committed to deep practical transformation'),
    transformation_promise: isPt
      ? 'Dominar o processo com segurança emocional, estratégia clara e ferramentas de acompanhamento diário.'
      : 'Master the process with emotional grounding, actionable strategies, and daily tracking tools.',
    benefits: isPt ? [
      'Acesso imediato a 4 módulos pedagógicos progressivos',
      'Rastreador interativo de hábitos e consistência com marcos de evolução',
      'Simulador de cenários práticos para tomadas de decisão sob pressão',
      'Diagnóstico de subtexto e comunicação para evitar armadilhas reativas',
      'Garantia incondicional de 7 dias com risco zero'
    ] : [
      'Immediate access to 4 progressive pedagogical modules',
      'Interactive streak and habit tracker with evolutionary milestones',
      'Real-world decision simulator for high-stakes choices',
      'Subtext & communication diagnostic tool to eliminate reactive pitfalls',
      'Unconditional 7-day 100% risk-free guarantee'
    ],
    cta_text: isPt ? 'INICIAR MINHA TRANSFORMAÇÃO AGORA' : 'START MY TRANSFORMATION NOW',
    premium_badge_text: isPt ? 'PROTOCOLO OFICIAL' : 'OFFICIAL PROTOCOL',
    offer_badge_text: includeOldPrice ? (isPt ? 'CONDIÇÃO ESPECIAL DE LANÇAMENTO' : 'SPECIAL LIMITED ENROLLMENT') : '',
    social_proof: isPt ? '+3.800 alunos formados e transformados' : '+3,800 active students transformed',
    payment_label_text: isPt ? 'Pagamento Seguro & Acesso Imediato' : 'Instant & Secure Enrollment',
    secure_payment_label: isPt ? 'Ambiente 100% Criptografado & Protegido' : '256-Bit Encrypted & 100% Safe',
    instant_access_label: isPt ? 'Acesso liberado imediatamente no seu e-mail' : 'Instant lifetime access sent to your email',
    preview_enabled: true,
    preview_title: isPt ? `Como Dominar ${capitalizedTopic} sem Reatividade ou Erros Comuns` : `How to Master ${capitalizedTopic} without Reactive Mistakes`,
    preview_subtitle: isPt ? 'A ciência prática e comportamental por trás de resultados consistentes.' : 'The behavioral science and tactical protocol behind lasting results.',
    preview_rating: '4.9 ⭐ (1,240+ avaliações verificadas)',
    preview_students_label: isPt ? '+3.800 Alunos' : '+3,800 Active Students',
    preview_guarantee_label: isPt ? 'Garantia Incondicional de 7 Dias' : '7-Day 100% Risk-Free Guarantee',
    preview_support_vip_label: isPt ? 'Suporte Dedicado' : 'Dedicated Specialist Support',
    preview_bonus_title: isPt ? 'Bônus Exclusivos Inclusos' : 'Included Masterclass Bonuses',
    preview_modules_label: isPt ? 'Grade Curricular Estruturada' : 'Structured Curriculum',
    preview_students_tag: isPt ? 'Acesso Vitalício' : 'Lifetime Access',
    preview_risk_zero_label: isPt ? 'Risco Zero' : 'Zero Risk',
    preview_guarantee_title: isPt ? 'Garantia Incondicional de 7 Dias' : 'Unconditional 7-Day Money-Back Guarantee',
    preview_guarantee_subtitle: isPt ? 'Teste todo o protocolo sem nenhum risco financeiro.' : 'Experience the entire protocol with complete peace of mind.',
    preview_guarantee_description: isPt
      ? 'Entre hoje, acesse todas as aulas, utilize os rastreadores e simuladores práticos. Se dentro de 7 dias você não sentir clareza absoluta e transformação tangível, devolvemos 100% do seu investimento sem perguntas.'
      : 'Enroll today, complete the lessons, and use the interactive trackers. If you do not feel immediate clarity and tangible progress within 7 days, request a full 100% refund with zero questions asked.',
    preview_footer_cta: isPt ? 'GARANTIR MINHA VAGA COM DESCONTO' : 'CLAIM MY ENROLLMENT DISCOUNT',
    preview_rich_text: isPt
      ? `<div class="space-y-6 text-gray-200">
          <h2 class="text-2xl font-bold text-white">O Fim da Incerteza e da Ansiedade</h2>
          <p>A maioria das pessoas tenta resolver essa área com base em conselhos genéricos, impulsividade ou desespero emocional. O resultado quase sempre é desgaste, frustração e perda de controle.</p>
          <div class="p-5 rounded-2xl bg-emerald-500/10 border-l-4 border-emerald-400 text-emerald-200 font-medium">
            <strong>O Princípio Fundamental:</strong> Resultados reais não dependem de sorte — dependem de clareza estratégica, postura emocional inabalável e execução sistemática.
          </div>
          <h3 class="text-xl font-semibold text-white">Para Quem É Este Programa</h3>
          <ul class="list-disc pl-6 space-y-2">
            <li>Pessoas que desejam assumir o controle de suas escolhas com método comprovado.</li>
            <li>Quem quer eliminar a reatividade e agir com postura magnética e segura.</li>
            <li>Quem valoriza ferramentas práticas com exercícios diários aplicáveis.</li>
          </ul>
        </div>`
      : `<div class="space-y-6 text-gray-200">
          <h2 class="text-2xl font-bold text-white">Ending Confusion and Reactive Decision-Making</h2>
          <p>Most individuals approach this challenge through impulse, over-thinking, or outdated advice. The outcome is almost always frustration and diminished self-worth.</p>
          <div class="p-5 rounded-2xl bg-emerald-500/10 border-l-4 border-emerald-400 text-emerald-200 font-medium">
            <strong>The Core Principle:</strong> Enduring success requires emotional grounding, psychological composure, and deliberate execution.
          </div>
        </div>`,
    art_direction: {
      mood: 'Editorial luxury, grounded calm authority, high-contrast typography',
      color_palette: ['#0F172A', '#1E293B', '#10B981', '#F8FAFC'],
      cover_prompt: 'Editorial portrait representing clarity, poise and grounded focus'
    }
  };

  const modules = [
    {
      order_index: 0,
      title: isPt ? 'Módulo 1: Fundamentos & Desintoxicação Mental' : 'Module 1: Foundations & Mental Reset',
      description: isPt ? 'Compreenda a raiz dos padrões reativos e estabeleça sua base de autoridade.' : 'Uncover underlying behavioral patterns and build an unshakable foundation.',
      objective: isPt ? 'Cessar a reatividade emocional e ativar clareza mental.' : 'Halt emotional reactivity and gain absolute tactical clarity.',
      chapters: [
        {
          order_index: 0,
          title: isPt ? 'Aula 1: O Mecanismo Central & Postura Estratégica' : 'Lesson 1: The Core Mechanism & Strategic Posture',
          description: isPt ? 'Entenda os princípios psicológicos que determinam valor e controle.' : 'Understand the psychological principles that determine leverage and composure.',
          duration_minutes: 20,
          content_type: 'interactive',
          interactive_content: {
            title: isPt ? 'O Mecanismo Central & Postura Estratégica' : 'The Core Mechanism & Strategic Posture',
            description: isPt ? 'Framework teórico e reflexão profunda para calibrar sua postura.' : 'Core framework and guided reflection to calibrate your mindset.',
            language,
            duration_minutes: 20,
            blocks: [
              {
                id: 'blk_1_1',
                type: 'text',
                title: isPt ? 'O Princípio da Não-Reatividade' : 'The Principle of Non-Reactivity',
                content: isPt
                  ? `<h3>A Dinâmica do Poder Pessoal</h3><p>Quem reage imediatamente a cada estímulo entrega o controle da situação. A primeira etapa para qualquer transformação é a capacidade de fazer uma pausa consciente entre o estímulo e a sua resposta.</p><div class="p-4 bg-emerald-500/10 border-l-4 border-emerald-400 rounded-r-2xl my-4 text-emerald-200"><strong>Regra de Ouro:</strong> Nunca responda quando estiver no pico da emoção. O silêncio estratégico sempre comunica mais valor do que o desespero explicativo.</div>`
                  : `<h3>The Dynamics of Personal Leverage</h3><p>Whoever reacts immediately to every external cue relinquishes control. The initial breakthrough in any transformation is inserting a conscious pause between stimulation and response.</p>`
              },
              {
                id: 'blk_1_2',
                type: 'reflection',
                title: isPt ? 'Diário Diagnóstico: Onde Você Tem Cedido?' : 'Diagnostic Journal: Identifying Compromises',
                instructions: isPt
                  ? 'Liste 3 momentos recentes em que você agiu por impulso ou medo. O que você faria de diferente hoje aplicando o princípio da pausa?'
                  : 'Identify 3 recent instances where you acted from impulse or anxiety. How would you handle them now applying the conscious pause?'
              }
            ]
          }
        },
        {
          order_index: 1,
          title: isPt ? 'Aula 2: Erros Reativos Comuns vs Protocolo Mestre' : 'Lesson 2: Common Reactive Pitfalls vs Master Protocol',
          description: isPt ? 'Análise comparativa das falhas mais frequentes e como corrigi-las.' : 'Side-by-side contrast revealing frequent mistakes and high-leverage corrections.',
          duration_minutes: 25,
          content_type: 'interactive',
          interactive_content: {
            title: isPt ? 'Erros Reativos vs Protocolo Mestre' : 'Reactive Pitfalls vs Master Protocol',
            description: isPt ? 'Comparativo lado a lado para calibrar sua conduta.' : 'Side-by-side comparison to calibrate your daily approach.',
            language,
            duration_minutes: 25,
            blocks: [
              {
                id: 'blk_1_3',
                type: 'comparison',
                title: isPt ? 'Postura Amadora vs Postura de Alto Valor' : 'Reactive Approach vs Master Protocol',
                items: [
                  {
                    id: 'c1',
                    title: isPt ? 'Gestão da Comunicação' : 'Communication Stance',
                    before_text: isPt ? 'Enviar mensagens longas justificando sentimentos ou cobrando posicionamento.' : 'Sending long paragraphs seeking validation or explanations.',
                    after_text: isPt ? 'Comunicação breve, polida e desapegada de resposta imediata.' : 'Brief, courteous, and completely detached from immediate outcomes.'
                  },
                  {
                    id: 'c2',
                    title: isPt ? 'Foco de Atenção' : 'Mental Focus',
                    before_text: isPt ? 'Ficar monitorando redes sociais e esperando validação externa.' : 'Checking status updates and obsessing over external reactions.',
                    after_text: isPt ? 'Investimento total na própria rotina, corpo e objetivos profissionais.' : 'Complete immersion in your own routine, health, and high-value goals.'
                  }
                ]
              }
            ]
          }
        }
      ]
    },
    {
      order_index: 1,
      title: isPt ? 'Módulo 2: Disciplina Emocional & O Rastreador de Consistência' : 'Module 2: Emotional Discipline & The Consistency Protocol',
      description: isPt ? 'Ferramentas ativas para sustentar sua nova postura sem recaídas.' : 'Active tools and trackers to sustain your progress without relapses.',
      objective: isPt ? 'Consolidar consistência diária e monitorar marcos de evolução.' : 'Consolidate daily momentum and achieve milestone badges.',
      chapters: [
        {
          order_index: 0,
          title: isPt ? 'Aula 1: Rastreador de Consistência & Desafio dos 30 Dias' : 'Lesson 1: Consistency Tracker & 30-Day Protocol',
          description: isPt ? 'Mini-aplicativo funcional para acompanhar sua sequência diária e conquistas.' : 'Interactive tracker app to log streaks, milestones, and daily focus.',
          duration_minutes: 25,
          content_type: 'interactive',
          interactive_content: {
            title: isPt ? 'Rastreador de Consistência & Foco' : 'Consistency & Focus Tracker',
            description: isPt ? 'Defina seu marco inicial e registre cada dia de vitória.' : 'Set your baseline date and track consecutive days of mastery.',
            language,
            duration_minutes: 25,
            blocks: [
              {
                id: 'blk_2_1',
                type: 'tracker',
                title: isPt ? 'Rastreador dos 30 Dias de Autonomia' : '30-Day Autonomy & Focus Streak',
                description: isPt ? 'Acompanhe seu avanço dia a dia e desbloqueie insígnias de autoridade.' : 'Track your daily streak and earn progression badges.',
                tracker_label: isPt ? 'Sequência de Foco e Autonomia' : 'Consecutive Days Streak',
                tracker_target_days: 30,
                tracker_milestones: [
                  { day: 1, title: isPt ? 'Primeiro Passo Dado' : 'First Step Conquered', reward_badge: '🛡️ Clareza' },
                  { day: 7, title: isPt ? '1 Semana de Firmeza' : '1 Week Milestone', reward_badge: '🔥 Disciplina' },
                  { day: 14, title: isPt ? 'Metade do Desafio' : 'Midway Breakthrough', reward_badge: '⚡ Controle' },
                  { day: 21, title: isPt ? 'Novo Hábito Forjado' : 'Habit Solidified', reward_badge: '👑 Postura' },
                  { day: 30, title: isPt ? 'Maestria Conquistada' : 'Mastery Achieved', reward_badge: '🏆 Soberania' }
                ],
                tracker_urge_instructions: isPt
                  ? 'Sentiu vontade de quebrar o protocolo? Respire fundo por 4 segundos, segure por 4, solte por 4. Beba um copo de água e faça 10 flexões antes de qualquer ação.'
                  : 'Feeling the urge to break the protocol? Take 3 deep diaphragmatic breaths, drink a glass of water, and pause for 15 minutes before acting.'
              }
            ]
          }
        },
        {
          order_index: 1,
          title: isPt ? 'Aula 2: Checklist do Protocolo de Emergência (SOS)' : 'Lesson 2: Emergency Protocol Checklist (SOS)',
          description: isPt ? 'Plano de ação em etapas para gerenciar momentos de crise emocional.' : 'Phased action checklist to navigate high-anxiety moments.',
          duration_minutes: 15,
          content_type: 'interactive',
          interactive_content: {
            title: isPt ? 'Protocolo de Emergência (SOS)' : 'Emergency SOS Protocol',
            description: isPt ? 'Siga os passos exatos antes de cometer qualquer ato impulsivo.' : 'Follow these verified steps before taking impulsive action.',
            language,
            duration_minutes: 15,
            blocks: [
              {
                id: 'blk_2_2',
                type: 'action_plan',
                title: isPt ? 'Etapas Imediatas de Controle de Impulso' : 'Immediate Impulse De-escalation',
                checklist_items: [
                  { id: 'sos_1', text: isPt ? 'Afastar o smartphone do campo de visão imediato por 30 minutos.' : 'Move your phone out of reach for at least 30 minutes.' },
                  { id: 'sos_2', text: isPt ? 'Escrever o que deseja falar em um bloco de notas privado, nunca no aplicativo de mensagens.' : 'Draft what you want to say in a private scratchpad, never in messaging apps.' },
                  { id: 'sos_3', text: isPt ? 'Avaliar: Essa ação aumenta ou diminui meu valor a longo prazo?' : 'Assess: Does this action increase or decrease my leverage long-term?' },
                  { id: 'sos_4', text: isPt ? 'Esperar 24 horas antes de tomar qualquer decisão definitiva.' : 'Sleep on it and enforce a strict 24-hour waiting rule.' }
                ]
              }
            ]
          }
        }
      ]
    },
    {
      order_index: 2,
      title: isPt ? 'Módulo 3: Análise de Subtexto & Simulador de Cenários' : 'Module 3: Subtext Analysis & Scenario Simulator',
      description: isPt ? 'Ferramentas interativas para decodificar intenções e testar respostas seguras.' : 'Interactive tools to decode underlying intentions and rehearse decisions.',
      objective: isPt ? 'Interpretar mensagens com precisão e responder com calibragem milimétrica.' : 'Read between the lines and make calibrated decisions under pressure.',
      chapters: [
        {
          order_index: 0,
          title: isPt ? 'Aula 1: Analisador de Temperatura & Subtexto (IA)' : 'Lesson 1: Subtext & Message Temperature Diagnostic',
          description: isPt ? 'Mini-ferramenta interativa para avaliar a temperatura e intenção de mensagens.' : 'Interactive diagnostic tool to analyze intent signals and temperature.',
          duration_minutes: 25,
          content_type: 'interactive',
          interactive_content: {
            title: isPt ? 'Analisador de Mensagens & Subtexto' : 'Message Temperature Analyzer',
            description: isPt ? 'Cole trechos reais para diagnosticar sinais de interesse ou teste.' : 'Paste communication samples to diagnose interest and test signals.',
            language,
            duration_minutes: 25,
            blocks: [
              {
                id: 'blk_3_1',
                type: 'ai_analyzer',
                title: isPt ? 'Diagnóstico de Temperatura da Comunicação' : 'Communication Temperature Diagnostic',
                analyzer_placeholder: isPt ? 'Cole aqui a mensagem recebida para diagnosticar o subtexto...' : 'Paste the received message here to diagnose subtext...',
                analyzer_sample_message: isPt ? 'Oi, sumido... tava pensando em você esses dias.' : 'Hey stranger... was just thinking about you the other day.',
                sample_analysis: {
                  temperature: 'Ambíguo / Sondagem de Baixo Custo',
                  signals: isPt ? ['Investimento mínimo', 'Teste de disponibilidade imediata', 'Curiosidade casual sem compromisso'] : ['Low investment probe', 'Availability test', 'Casual curiosity'],
                  advice_dos: isPt ? ['Responder de forma cordial, porém breve e sem urgência', 'Manter o foco na sua rotina atual'] : ['Respond politely but without urgency', 'Maintain frame and focus on your priorities'],
                  advice_donts: isPt ? ['Não mandar textões nem perguntar onde a pessoa esteve', 'Não se mostrar excessivamente disponível'] : ['Do not send paragraphs', 'Do not display sudden over-eagerness']
                }
              }
            ]
          }
        },
        {
          order_index: 1,
          title: isPt ? 'Aula 2: Simulador de Cenários & Árvore de Decisão' : 'Lesson 2: Scenario Decision Tree Simulator',
          description: isPt ? 'Simulador prático com escolhas reais e consequências comportamentais.' : 'Interactive decision tree simulator with real consequences.',
          duration_minutes: 20,
          content_type: 'interactive',
          interactive_content: {
            title: isPt ? 'Simulador de Decisão Crítica' : 'Critical Scenario Simulator',
            description: isPt ? 'Escolha sua resposta e veja a consequência imediata na dinâmica.' : 'Select your move and observe the pedagogical consequence.',
            language,
            duration_minutes: 20,
            blocks: [
              {
                id: 'blk_3_2',
                type: 'simulator',
                title: isPt ? 'Cenário: O Contato Repentino em Momento Inesperado' : 'Scenario: The Unexpected Late Message',
                scenario_text: isPt
                  ? 'Você recebe uma mensagem casual em uma sexta-feira à noite após semanas de silêncio: "Tudo bem por aí?". Qual é a melhor postura?'
                  : 'You receive a casual late message after weeks of silence: "How have you been?". What is your optimal move?',
                choices: [
                  {
                    id: 'sim_ch_1',
                    label: isPt ? 'Responder em 1 minuto: "Oi! Tudo bem sim, que bom que você mandou mensagem!"' : 'Reply within 1 minute enthusiastically',
                    is_optimal: false,
                    feedback: isPt ? '❌ Reação Precipitada: Comunica que você estava esperando e disponível a qualquer momento.' : '❌ Reactive mistake: Displays immediate availability and over-eagerness.'
                  },
                  {
                    id: 'sim_ch_2',
                    label: isPt ? 'Responder na manhã seguinte: "Tudo bem por aqui, e com você?"' : 'Reply next morning calmly: "Doing well, hope all is good with you."',
                    is_optimal: true,
                    feedback: isPt ? '✅ Postura de Alto Valor: Demonstra boa educação sem afobação nem submissão.' : '✅ Optimal posture: Demonstrates polite warmth without dropping your boundaries.'
                  },
                  {
                    id: 'sim_ch_3',
                    label: isPt ? 'Cobrar o sumiço e reclamar da demora em procurar você.' : 'Confront them defensively about the silence.',
                    is_optimal: false,
                    feedback: isPt ? '❌ Reatividade Tóxica: Transmite ressentimento e confirma que a outra pessoa ainda controla seu humor.' : '❌ High reactivity: Shows resentment and confirms they still dictate your state.'
                  }
                ]
              }
            ]
          }
        }
      ]
    },
    {
      order_index: 3,
      title: isPt ? 'Módulo 4: Avaliação de Prontidão & Consolidação' : 'Module 4: Readiness Evaluation & Long-Term Mastery',
      description: isPt ? 'Teste seu nível de soberania emocional e estabeleça seu plano permanente.' : 'Test your emotional sovereignty and establish your permanent plan.',
      objective: isPt ? 'Validar competências adquiridas e blindar seu progresso futuro.' : 'Validate acquired competencies and shield future progress.',
      chapters: [
        {
          order_index: 0,
          title: isPt ? 'Aula 1: Teste Diagnóstico de Prontidão & Soberania' : 'Lesson 1: Readiness & Sovereignty Diagnostic',
          description: isPt ? 'Calculadora com pontuação e recomendações personalizadas.' : 'Scored diagnostic evaluator with tiered recommendations.',
          duration_minutes: 20,
          content_type: 'interactive',
          interactive_content: {
            title: isPt ? 'Teste Diagnóstico de Prontidão' : 'Readiness & Sovereignty Diagnostic',
            description: isPt ? 'Responda com honestidade para medir seu nível de equilíbrio.' : 'Answer honestly to compute your current sovereignty index.',
            language,
            duration_minutes: 20,
            blocks: [
              {
                id: 'blk_4_1',
                type: 'readiness_evaluator',
                title: isPt ? 'Índice de Prontidão e Autoridade Pessoal' : 'Personal Sovereignty & Readiness Index',
                questions: [
                  { id: 'q1', statement: isPt ? 'Consigo passar um dia inteiro sem checar a vida alheia nas redes sociais.' : 'I can go an entire day without checking someone else\'s social feeds.', weight: 25 },
                  { id: 'q2', statement: isPt ? 'Minha autoestima é ancorada nas minhas próprias realizações e valores diários.' : 'My self-worth is anchored in my own daily habits and personal values.', weight: 25 },
                  { id: 'q3', statement: isPt ? 'Quando recebo uma provocação, consigo aguardar antes de qualquer reação.' : 'When provoked or tested, I easily pause before formulating any reaction.', weight: 25 },
                  { id: 'q4', statement: isPt ? 'Tenho objetivos claros de vida que não dependem da aprovação de ninguém.' : 'I have defined life targets that require zero external validation.', weight: 25 }
                ],
                tiers: [
                  { min_score: 0, max_score: 50, diagnosis: isPt ? 'Fase de Vulnerabilidade: Redobre o uso do Rastreador de Consistência e mantenha o protocolo de emergência ativo.' : 'Vulnerability Phase: Intensify daily tracking and review Module 1 principles.' },
                  { min_score: 51, max_score: 80, diagnosis: isPt ? 'Fase de Fortalecimento: Você já possui bons filtros, mantenha a consistência sem relaxar a guarda.' : 'Strengthening Phase: Great progress. Stay grounded and maintain healthy boundaries.' },
                  { min_score: 81, max_score: 100, diagnosis: isPt ? 'Fase de Soberania Plena: Alto autocontrole e postura magnética instalada.' : 'Sovereignty Mastered: Superb composure, magnetic frame, and complete autonomy.' }
                ]
              }
            ]
          }
        },
        {
          order_index: 1,
          title: isPt ? 'Aula 2: Quiz de Validação da Maestria' : 'Lesson 2: Final Protocol Validation Quiz',
          description: isPt ? 'Valide os conceitos essenciais com feedback didático imediato.' : 'Confirm your retention of the core principles with explanatory feedback.',
          duration_minutes: 15,
          content_type: 'interactive',
          interactive_content: {
            title: isPt ? 'Quiz de Validação da Maestria' : 'Mastery Validation Quiz',
            description: isPt ? '3 questões rápidas para selar seu aprendizado definitivo.' : '3 quick questions to cement your mastery.',
            language,
            duration_minutes: 15,
            blocks: [
              {
                id: 'blk_4_2',
                type: 'quiz',
                title: isPt ? 'Validação dos Princípios Inegociáveis' : 'Validation of Core Non-Negotiables',
                questions: [
                  {
                    id: 'qz_1',
                    question: isPt ? 'Qual é a função primordial da Não-Reatividade?' : 'What is the primary function of Non-Reactivity?',
                    options: [
                      isPt ? 'Mostrar frieza e desprezo fingido para manipular o outro' : 'Pretend to be cold to manipulate someone',
                      isPt ? 'Preservar sua dignidade e permitir que a razão guie suas decisões' : 'Preserve your dignity and allow composure to govern choices',
                      isPt ? 'Fingir que não se importa enquanto chora escondido' : 'Hide your pain while secretly obsessing'
                    ],
                    correct_option_index: 1,
                    explanation: isPt ? 'A verdadeira não-reatividade não é um teatro, mas a escolha consciente de não entregar seu poder.' : 'True non-reactivity is not acting; it is sovereign self-preservation.'
                  }
                ]
              }
            ]
          }
        }
      ]
    }
  ];

  return { course, modules };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const {
      command,
      referenceImage,
      language = 'en',
      priceTier = 97,
      includeOldPrice = true,
      tone = 'authoritative_empathetic',
      targetAudience
    } = req.body || {};

    if (!command || typeof command !== 'string' || !command.trim()) {
      return res.status(400).json({ error: 'A course command or instruction is required.' });
    }

    const ai = getAiClient();
    // Use gemini-3.8-flash as primary text model, with fallbacks to other active models
    const candidateModels = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];

    const targetPriceCents = Math.round(Number(priceTier) * 100) || 9700;
    const targetOldPriceCents = includeOldPrice ? Math.round(targetPriceCents * 2) : 0;

    const langNameMap: Record<string, string> = {
      en: 'English (United States)',
      'en-US': 'English (United States)',
      'pt-BR': 'Portuguese (Brazil)',
      pt: 'Portuguese (Brazil)',
      es: 'Spanish',
      fr: 'French',
      de: 'German',
      it: 'Italian'
    };
    const targetLangName = langNameMap[language] || 'English (United States)';

    console.log(`[AI Course Factory] Generating complete course for command: "${command.slice(0, 60)}..." in ${targetLangName}`);

    // System instruction for the Master Course Architect
    const systemInstruction = `You are a World-Class Master Instructional Designer, Neuro-Copywriting Director, Executive Curriculum Architect, and EdTech Educational Product Engineer.
You design high-value, transformative online academies.

YOUR MISSION:
From the user's prompt instruction, design a COMPLETE, READY-TO-PUBLISH, HIGH-VALUE COURSE in valid JSON:
1. Course metadata & CRO Sales Copywriting & FAQ in HTML.
2. 3 to 4 progressive pedagogical modules with 2 to 3 lessons each.
3. Automatically select the BEST INTERACTIVE LESSON TYPE for each lesson:
   - "tracker": Functional habit, streak or challenge tracker with target days and milestones.
   - "ai_analyzer": Real-world message temperature or subtext decryption diagnostic.
   - "simulator": Realistic scenario decision tree with choices and consequences.
   - "readiness_evaluator" or "calculator": Diagnostic scoring test with weights and recommendations.
   - "action_plan": Actionable tactical step checklist.
   - "comparison": Flawed reactive approach ❌ vs High-value strategic master protocol ✅.
   - "reflection": Guided executive coaching journal prompt.
   - "quiz": Multiple-choice interactive validation with explanation.
   - "text": Rich HTML masterclass insights with <h3>, <p>, and callout boxes.

LANGUAGE MANDATE:
All titles, descriptions, copy, lessons, and labels MUST be written strictly in ${targetLangName.toUpperCase()}!

OUTPUT FORMAT:
Return ONLY a valid JSON object matching this schema:
{
  "course": {
    "title": "Impactful Course Title in ${targetLangName}",
    "subtitle": "Compelling Sub-headline in ${targetLangName}",
    "description": "Comprehensive overview in ${targetLangName}",
    "price": ${targetPriceCents},
    "old_price": ${targetOldPriceCents},
    "category": "Development & Relationships",
    "level": "Masterclass / Complete",
    "estimated_duration": "4 to 6 Weeks",
    "target_audience": "Description of student in ${targetLangName}",
    "transformation_promise": "Measurable shift achieved",
    "benefits": ["Benefit 1", "Benefit 2", "Benefit 3", "Benefit 4", "Benefit 5"],
    "cta_text": "START TRANSFORMATION NOW",
    "premium_badge_text": "EXCLUSIVE PROTOCOL",
    "offer_badge_text": "${includeOldPrice ? 'SPECIAL OFFER • 50% OFF' : ''}",
    "social_proof": "+4,200 active students transformed",
    "payment_label_text": "Instant & Secure Checkout",
    "secure_payment_label": "256-Bit Encrypted & Safe",
    "instant_access_label": "Immediate Lifetime Access",
    "preview_enabled": true,
    "preview_title": "Headline in ${targetLangName}",
    "preview_subtitle": "Hook explaining psychological breakthrough",
    "preview_rating": "4.9 ⭐ (1,240+ verified reviews)",
    "preview_students_label": "+4,200 Students",
    "preview_guarantee_label": "7-Day 100% Risk-Free Guarantee",
    "preview_support_vip_label": "Dedicated Expert Support",
    "preview_bonus_title": "Included Masterclass Bonuses",
    "preview_modules_label": "Curriculum Structure",
    "preview_students_tag": "Lifetime Access",
    "preview_risk_zero_label": "100% Risk-Free",
    "preview_guarantee_title": "7-Day Money-Back Guarantee",
    "preview_guarantee_subtitle": "Test the protocol with zero risk",
    "preview_guarantee_description": "Join today and test everything. If you do not experience deep transformation, receive an instant 100% refund.",
    "preview_footer_cta": "ENROLL IN THE COMPLETE ACADEMY NOW",
    "preview_rich_text": "<div class='space-y-6 text-gray-200'><h3>Core Problem</h3><p>Insightful analysis...</p></div>",
    "art_direction": {
      "mood": "Editorial luxury, grounded calm authority",
      "color_palette": ["#0F172A", "#1E293B", "#10B981", "#F8FAFC"],
      "cover_prompt": "Editorial portrait representing clarity and quiet confidence"
    }
  },
  "modules": [
    {
      "order_index": 0,
      "title": "Module 1: Title in ${targetLangName}",
      "description": "Module pedagogical focus in ${targetLangName}",
      "objective": "Primary outcome for this module",
      "chapters": [
        {
          "order_index": 0,
          "title": "Lesson 1: Title in ${targetLangName}",
          "description": "Summary in ${targetLangName}",
          "duration_minutes": 20,
          "content_type": "interactive",
          "interactive_content": {
            "title": "Lesson Title in ${targetLangName}",
            "description": "Summary in ${targetLangName}",
            "language": "${language}",
            "duration_minutes": 20,
            "blocks": [
              {
                "id": "blk_1",
                "type": "text",
                "title": "The Strategic Principle",
                "content": "<h3>Core Insight</h3><p>Detailed explanation...</p>"
              }
            ]
          }
        }
      ]
    }
  ]
}`;

    const userPrompt = `Build a complete, elite-tier educational course based on this command:
"${command}"

Specifications:
- Language: ${targetLangName} (All text strictly in ${targetLangName})
- Price: $${priceTier}
- Tone: ${tone}
${targetAudience ? `- Target Audience: ${targetAudience}` : ''}

REQUIREMENTS:
1. Create 3 to 4 cohesive, structured modules.
2. In each module, include 2 to 3 high-value lessons.
3. Incorporate diverse interactive elements:
   - At least 1 "tracker" block with target days and milestones.
   - At least 1 "ai_analyzer" block (message temperature / subtext diagnostic).
   - At least 1 "simulator" block (scenario decision tree with choices).
   - At least 1 "readiness_evaluator" or "quiz" or "action_plan" or "comparison" block.
4. Provide persuasive HTML sales copy in 'preview_rich_text'.
5. Return strictly valid JSON.`;

    const contents: any[] = [];
    if (referenceImage && typeof referenceImage === 'string') {
      if (referenceImage.startsWith('data:image/')) {
        const matches = referenceImage.match(/^data:(.+);base64,(.+)$/);
        if (matches) {
          contents.push({
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: matches[1],
                  data: matches[2],
                },
              },
              { text: userPrompt },
            ],
          });
        } else {
          contents.push({ role: 'user', parts: [{ text: userPrompt }] });
        }
      } else {
        contents.push({ role: 'user', parts: [{ text: `${userPrompt}\nReference Image URL: ${referenceImage}` }] });
      }
    } else {
      contents.push({ role: 'user', parts: [{ text: userPrompt }] });
    }

    let parsedData: any = null;
    let isFallback = false;

    try {
      // Call Gemini with intelligent multi-model fallback and progressive backoff
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
        baseDelayMs: 1400,
        logPrefix: '[AI Course Factory]'
      });

      console.log(`[AI Course Factory] Successfully received generation from model ${result.modelUsed}`);
      parsedData = safeParseAiJson(result.text);
    } catch (genError: any) {
      console.warn('[AI Course Factory] AI generation experienced an error, engaging resilient fallback:', genError?.message || genError);

      // If Gemini experienced 503 high demand or transient API failure after all retries,
      // construct a comprehensive high-value tailored fallback course
      const fallbackPackage = buildResilientFallbackCourse({
        command,
        language,
        priceTier: Number(priceTier) || 97,
        includeOldPrice,
        tone,
        targetAudience
      });

      parsedData = fallbackPackage;
      isFallback = true;
    }

    // Hydrate and validate the course structure
    const coursePayload = parsedData.course || {};
    const modulesPayload = parsedData.modules || [];

    // Assign coherent visual covers
    const totalChapters = modulesPayload.reduce((acc: number, m: any) => acc + (m.chapters?.length || 0), 0);
    const coverUrls = selectThematicCovers(command + ' ' + (coursePayload.title || ''), totalChapters + 1);

    coursePayload.cover_url = coverUrls[0];
    coursePayload.premium_cover_url = coverUrls[0];
    coursePayload.is_active = true;
    coursePayload.is_free = false;
    coursePayload.is_bonus = false;

    let coverIdx = 1;
    for (let mIdx = 0; mIdx < modulesPayload.length; mIdx++) {
      const mod = modulesPayload[mIdx];
      mod.order_index = mIdx;
      if (!Array.isArray(mod.chapters)) {
        mod.chapters = [];
      }

      for (let cIdx = 0; cIdx < mod.chapters.length; cIdx++) {
        const chap = mod.chapters[cIdx];
        chap.order_index = cIdx;
        chap.cover_url = coverUrls[coverIdx % coverUrls.length];
        coverIdx++;
        chap.is_free = cIdx === 0 && mIdx === 0; // First lesson of first module is free preview
        chap.is_preview = chap.is_free;
        chap.duration_minutes = Number(chap.duration_minutes) || 20;

        // Ensure interactive_content and rich_text are synchronized
        if (chap.interactive_content) {
          chap.content_type = 'interactive';
          chap.rich_text = typeof chap.interactive_content === 'string'
            ? chap.interactive_content
            : JSON.stringify(chap.interactive_content);
        } else if (!chap.rich_text) {
          chap.content_type = 'interactive';
          chap.rich_text = JSON.stringify({
            title: chap.title,
            description: chap.description || '',
            language,
            blocks: [
              {
                id: 'blk_text',
                type: 'text',
                title: chap.title,
                content: `<h3>${chap.title}</h3><p>${chap.description || 'Welcome to this lesson.'}</p>`
              }
            ]
          });
        }
      }
    }

    return res.status(200).json({
      success: true,
      isFallback,
      course: coursePayload,
      modules: modulesPayload,
      stats: {
        totalModules: modulesPayload.length,
        totalChapters,
        estimatedDuration: coursePayload.estimated_duration || '4-6 Weeks',
        targetAudience: coursePayload.target_audience
      }
    });

  } catch (error: any) {
    console.error('[AI Course Factory] Error:', error);
    return res.status(500).json({
      error: error.message || 'Internal server error while building course with AI'
    });
  }
}
