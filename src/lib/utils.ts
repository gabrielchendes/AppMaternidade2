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

    if (!response.ok) {
      try {
        const errorJson = JSON.parse(text);
        return { error: errorJson.error || `API Error ${response.status}: ${text.substring(0, 50)}`, status: response.status };
      } catch (e) {
        return { error: `API Error ${response.status}`, status: response.status };
      }
    }

    if (!text || text === "undefined") {
      return null;
    }

    try {
      return JSON.parse(text);
    } catch (err) {
      console.error('🚨 Error parsing JSON:', text);
      return { error: 'Server response is not valid JSON' };
    }
  } catch (err: any) {
    console.error('🚨 Fetch request error:', url, err);
    return { error: 'Server connection error: ' + err.message };
  }
}
