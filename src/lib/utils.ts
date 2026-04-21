import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Safely parses a JSON string, returning null if parsing fails or value is invalid.
 */
export function safeParse(value: any) {
  console.log("Valor recebido para parse:", value);
  try {
    if (!value || value === "undefined" || typeof value !== 'string') {
      return null;
    }
    return JSON.parse(value);
  } catch (err) {
    console.error("Erro ao fazer parse do JSON:", err);
    return null;
  }
}

export async function safeFetch(url: string, options: RequestInit = {}) {
  try {
    const response = await fetch(url, options);
    const text = await response.text();

    console.log('📡 Resposta da API:', url, text);

    if (!text || text === "undefined") {
      console.error('🚨 API retornou valor inválido:', url);
      return null;
    }

    try {
      return JSON.parse(text);
    } catch (err) {
      console.error('🚨 Erro ao parsear JSON:', text);
      return null;
    }
  } catch (err) {
    console.error('🚨 Erro na requisição fetch:', url, err);
    return null;
  }
}
