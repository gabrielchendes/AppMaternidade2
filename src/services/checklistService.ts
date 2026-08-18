import { supabase } from '../lib/supabase';
import { Checklist, ChecklistItem, UserChecklistProgress } from '../types/lms';

/**
 * Service to manage checklists, checklist items, and individual user progress.
 * Supports Supabase database tables with graceful fallback to chapter.rich_text and localStorage
 * if tables have not been created in Supabase yet.
 */

export const RECONNECTION_CHECKLIST_TEMPLATE: Partial<Checklist> = {
  title: 'Jornada de Reconexão e Autocuidado',
  description: 'Um guia prático e reflexivo para acompanhar seus passos com consciência, respeito próprio e clareza emocional.',
  instructions: 'Marque cada etapa à medida que vivenciar ou colocar em prática na sua rotina. Siga no seu próprio tempo.',
  items: [
    // Etapa 1 — Pare e avalie
    {
      id: 'template_item_1',
      title: 'Entendi quais foram os principais motivos do término.',
      description: 'Refleti sobre as causas reais do fim sem buscar culpados, focando no aprendizado.',
      category: 'Etapa 1 — Pare e avalie',
      sort_order: 1,
      required: true,
      is_active: true
    },
    {
      id: 'template_item_2',
      title: 'Consegui identificar comportamentos meus que contribuíram para os problemas.',
      description: 'Assumi minha responsabilidade na dinâmica do relacionamento sem me culpar excessivamente.',
      category: 'Etapa 1 — Pare e avalie',
      sort_order: 2,
      required: true,
      is_active: true
    },
    {
      id: 'template_item_3',
      title: 'Evitei tomar decisões impulsivas motivadas pela ansiedade.',
      description: 'Respirei fundo antes de reagir no calor do momento ou mandar mensagens desesperadas.',
      category: 'Etapa 1 — Pare e avalie',
      sort_order: 3,
      required: false,
      is_active: true
    },

    // Etapa 2 — Reconstrução pessoal
    {
      id: 'template_item_4',
      title: 'Estou retomando minha rotina pessoal.',
      description: 'Voltando a praticar exercícios, cuidar do meu trabalho, sono e alimentação.',
      category: 'Etapa 2 — Reconstrução pessoal',
      sort_order: 4,
      required: true,
      is_active: true
    },
    {
      id: 'template_item_5',
      title: 'Estou cuidando da minha autoestima e bem-estar.',
      description: 'Dedicando tempo para atividades que me trazem alegria e renovam minha energia.',
      category: 'Etapa 2 — Reconstrução pessoal',
      sort_order: 5,
      required: true,
      is_active: true
    },
    {
      id: 'template_item_6',
      title: 'Estou evitando colocar minha vida inteira em função da reconciliação.',
      description: 'Reconheço que meu valor não depende da validação de outra pessoa.',
      category: 'Etapa 2 — Reconstrução pessoal',
      sort_order: 6,
      required: false,
      is_active: true
    },

    // Etapa 3 — Comunicação
    {
      id: 'template_item_7',
      title: 'Avaliei se este é realmente um bom momento para entrar em contato.',
      description: 'Certifiquei-me de que estou agindo com calma e clareza, não por desespero.',
      category: 'Etapa 3 — Comunicação',
      sort_order: 7,
      required: true,
      is_active: true
    },
    {
      id: 'template_item_8',
      title: 'Estou preparada para respeitar a resposta e os limites do meu ex.',
      description: 'Compreendo que o respeito ao espaço alheio é indispensável para qualquer reconexão.',
      category: 'Etapa 3 — Comunicação',
      sort_order: 8,
      required: true,
      is_active: true
    },
    {
      id: 'template_item_9',
      title: 'Minha comunicação será natural e sem pressão.',
      description: 'Sem cobranças sobre o passado ou cobrança de compromisso imediato.',
      category: 'Etapa 3 — Comunicação',
      sort_order: 9,
      required: false,
      is_active: true
    },

    // Etapa 4 — Reconexão
    {
      id: 'template_item_10',
      title: 'Observei se existe abertura para uma conversa.',
      description: 'Avaliando se o diálogo flui de maneira leve e recíproca.',
      category: 'Etapa 4 — Reconexão',
      sort_order: 10,
      required: true,
      is_active: true
    },
    {
      id: 'template_item_11',
      title: 'Estou avançando gradualmente.',
      description: 'Respeitando cada pequena etapa sem acelerar processos ou criar expectativas irrealistas.',
      category: 'Etapa 4 — Reconexão',
      sort_order: 11,
      required: true,
      is_active: true
    },
    {
      id: 'template_item_12',
      title: 'Estou avaliando as atitudes e não apenas as palavras.',
      description: 'Observando coerência e maturidade nos comportamentos demonstrados na prática.',
      category: 'Etapa 4 — Reconexão',
      sort_order: 12,
      required: false,
      is_active: true
    }
  ]
};

export async function fetchChecklistByChapterId(chapterId: string): Promise<Checklist | null> {
  if (!chapterId) return null;

  try {
    // 1. Try fetching from Supabase tables 'checklists' and 'checklist_items'
    const { data: checklistData, error: clError } = await supabase
      .from('checklists')
      .select('*')
      .eq('chapter_id', chapterId)
      .maybeSingle();

    if (!clError && checklistData) {
      const { data: itemsData, error: itemsError } = await supabase
        .from('checklist_items')
        .select('*')
        .eq('checklist_id', checklistData.id)
        .order('sort_order', { ascending: true });

      if (!itemsError && itemsData && itemsData.length > 0) {
        return {
          id: checklistData.id,
          chapter_id: chapterId,
          title: checklistData.title || '',
          description: checklistData.description || '',
          instructions: checklistData.instructions || '',
          image_url: checklistData.image_url || '',
          items: itemsData.map(item => ({
            id: item.id,
            checklist_id: item.checklist_id,
            chapter_id: item.chapter_id || chapterId,
            title: item.title,
            description: item.description || '',
            category: item.category || '',
            sort_order: item.sort_order ?? 0,
            required: item.required ?? false,
            is_active: item.is_active ?? true
          }))
        };
      }
    }

    // Direct query fallback for checklist_items by chapter_id
    const { data: itemsDirect, error: itemsDirectError } = await supabase
      .from('checklist_items')
      .select('*')
      .eq('chapter_id', chapterId)
      .order('sort_order', { ascending: true });

    if (!itemsDirectError && itemsDirect && itemsDirect.length > 0) {
      return {
        id: itemsDirect[0].checklist_id || chapterId,
        chapter_id: chapterId,
        title: checklistData?.title || 'Checklist',
        description: checklistData?.description || '',
        instructions: checklistData?.instructions || '',
        image_url: checklistData?.image_url || '',
        items: itemsDirect.map(item => ({
          id: item.id,
          checklist_id: item.checklist_id,
          chapter_id: chapterId,
          title: item.title,
          description: item.description || '',
          category: item.category || '',
          sort_order: item.sort_order ?? 0,
          required: item.required ?? false,
          is_active: item.is_active ?? true
        }))
      };
    }
  } catch (err) {
    console.warn('Checklist database tables not queried or unavailable, falling back to chapter JSON data:', err);
  }

  // Fallback: Fetch chapter's rich_text column where checklist JSON is stored
  try {
    const { data: chapterData } = await supabase
      .from('chapters')
      .select('rich_text, title, description')
      .eq('id', chapterId)
      .single();

    if (chapterData?.rich_text) {
      try {
        const parsed = JSON.parse(chapterData.rich_text);
        if (parsed && Array.isArray(parsed.items)) {
          return {
            id: parsed.id || chapterId,
            chapter_id: chapterId,
            title: parsed.title || chapterData.title || 'Checklist',
            description: parsed.description || chapterData.description || '',
            instructions: parsed.instructions || '',
            image_url: parsed.image_url || '',
            items: parsed.items
          };
        }
      } catch (e) {
        // rich_text was not JSON
      }
    }
  } catch (err) {
    console.error('Error fetching chapter fallback for checklist:', err);
  }

  return null;
}

export async function saveChecklistToDatabase(
  chapterId: string,
  checklistData: Partial<Checklist>
): Promise<void> {
  if (!chapterId) return;

  const items = checklistData.items || [];
  const title = checklistData.title || 'Checklist';
  const description = checklistData.description || '';
  const instructions = checklistData.instructions || '';
  const image_url = checklistData.image_url || '';

  // Always save a JSON representation inside chapter.rich_text as a robust fallback
  const jsonPayload = JSON.stringify({
    id: checklistData.id || chapterId,
    chapter_id: chapterId,
    title,
    description,
    instructions,
    image_url,
    items
  });

  try {
    await supabase
      .from('chapters')
      .update({
        rich_text: jsonPayload,
        title: title || undefined,
        description: description || undefined
      })
      .eq('id', chapterId);
  } catch (err) {
    console.warn('Could not update rich_text fallback for chapter:', err);
  }

  // Also attempt upsert into 'checklists' and 'checklist_items' tables if present
  try {
    const { data: clRecord, error: clErr } = await supabase
      .from('checklists')
      .upsert({
        chapter_id: chapterId,
        title,
        description,
        instructions,
        image_url,
        updated_at: new Date().toISOString()
      }, { onConflict: 'chapter_id' })
      .select('id')
      .single();

    const checklistId = clRecord?.id || checklistData.id || chapterId;

    if (!clErr && checklistId) {
      // Remove previous items and re-insert new items for clean state
      await supabase
        .from('checklist_items')
        .delete()
        .eq('checklist_id', checklistId);

      if (items.length > 0) {
        const dbItems = items.map((it, idx) => ({
          id: it.id && !it.id.startsWith('template_') && !it.id.startsWith('new_') ? it.id : undefined,
          checklist_id: checklistId,
          chapter_id: chapterId,
          title: it.title,
          description: it.description || '',
          category: it.category || '',
          sort_order: it.sort_order ?? idx,
          required: it.required ?? false,
          is_active: it.is_active ?? true
        }));

        await supabase.from('checklist_items').insert(dbItems);
      }
    }
  } catch (err) {
    console.warn('Supabase checklists table update error (using fallback JSON storage):', err);
  }
}

export async function fetchUserChecklistProgress(
  userId: string,
  chapterId: string
): Promise<Record<string, boolean>> {
  const result: Record<string, boolean> = {};

  if (!userId || !chapterId) return result;

  // 1. Load from localStorage cache first for immediate response
  const localKey = `user_checklist_progress_${userId}_${chapterId}`;
  try {
    const cached = localStorage.getItem(localKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      Object.assign(result, parsed);
    }
  } catch (e) {
    // Ignore cache error
  }

  // 2. Load from Supabase user_checklist_progress
  try {
    const { data, error } = await supabase
      .from('user_checklist_progress')
      .select('item_id, completed')
      .eq('user_id', userId)
      .eq('chapter_id', chapterId);

    if (!error && data) {
      data.forEach((row: any) => {
        result[row.item_id] = !!row.completed;
      });
      // Sync local storage cache
      try {
        localStorage.setItem(localKey, JSON.stringify(result));
      } catch (e) {}
    }
  } catch (err) {
    console.warn('user_checklist_progress table not available, relying on local storage cache:', err);
  }

  return result;
}

export async function saveUserChecklistProgressItem(
  userId: string,
  chapterId: string,
  itemId: string,
  completed: boolean,
  checklistId?: string
): Promise<void> {
  if (!userId || !chapterId || !itemId) return;

  // 1. Immediate local cache update
  const localKey = `user_checklist_progress_${userId}_${chapterId}`;
  try {
    const cached = localStorage.getItem(localKey);
    const map = cached ? JSON.parse(cached) : {};
    map[itemId] = completed;
    localStorage.setItem(localKey, JSON.stringify(map));
  } catch (e) {}

  // 2. Persist to Supabase
  try {
    const payload: any = {
      user_id: userId,
      chapter_id: chapterId,
      item_id: itemId,
      completed,
      completed_at: completed ? new Date().toISOString() : null
    };
    if (checklistId) {
      payload.checklist_id = checklistId;
    }

    const { error } = await supabase
      .from('user_checklist_progress')
      .upsert(payload, { onConflict: 'user_id,item_id' });

    if (error) {
      console.warn('Upsert to user_checklist_progress failed, attempting fallback update/insert:', error);
      // Fallback if composite constraint name differs
      await supabase
        .from('user_checklist_progress')
        .delete()
        .eq('user_id', userId)
        .eq('item_id', itemId);

      if (completed) {
        await supabase
          .from('user_checklist_progress')
          .insert([payload]);
      }
    }
  } catch (err) {
    console.warn('Could not persist user_checklist_progress to Supabase (progress cached locally):', err);
  }
}
