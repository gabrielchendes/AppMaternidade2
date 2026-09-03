import { Chapter } from '../types/lms';

export const HTML_APP_PREFIX = '<!-- HTML_APP -->';

/**
 * Checks if the content string is an HTML Mini App.
 */
export function isHtmlAppContent(content?: string | null): boolean {
  if (!content) return false;
  const trimmed = content.trim();

  // Explicit prefix marker
  if (trimmed.startsWith(HTML_APP_PREFIX)) return true;

  // JSON format marker: {"type":"html_app", ...}
  if (trimmed.startsWith('{"type":"html_app"') || trimmed.startsWith('{"type": "html_app"')) return true;

  // Raw HTML heuristics (if not an AI-blocks JSON lesson)
  if (!trimmed.startsWith('{')) {
    const lower = trimmed.toLowerCase();
    if (
      lower.includes('<!doctype html') ||
      lower.includes('<html') ||
      lower.includes('<head') ||
      lower.includes('<body') ||
      (lower.includes('<script') && lower.includes('</script>')) ||
      (lower.includes('<style') && lower.includes('</style>'))
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Checks if a chapter represents an HTML Mini App
 */
export function isHtmlAppChapter(chapter?: Partial<Chapter> | null): boolean {
  if (!chapter) return false;
  if (chapter.content_type === 'html_app') return true;
  if (chapter.content_type === 'interactive' || chapter.content_type === 'text') {
    return isHtmlAppContent(chapter.rich_text);
  }
  return false;
}

/**
 * Formats HTML content for database storage, ensuring it satisfies the DB check constraint
 * while preserving detection as an HTML Mini App.
 */
export function formatHtmlAppContent(rawHtml: string): string {
  const trimmed = (rawHtml || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith(HTML_APP_PREFIX)) {
    return trimmed;
  }
  return `${HTML_APP_PREFIX}\n${trimmed}`;
}

/**
 * Extracts the clean HTML code for execution and editing, stripping any internal markers.
 */
export function extractHtmlAppContent(storedContent?: string | null): string {
  if (!storedContent) return '';
  const trimmed = storedContent.trim();
  if (trimmed.startsWith(HTML_APP_PREFIX)) {
    return trimmed.slice(HTML_APP_PREFIX.length).replace(/^\r?\n/, '');
  }
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && (parsed.type === 'html_app' || parsed.is_html_app) && parsed.html) {
        return parsed.html;
      }
    } catch {
      // Not JSON, return as is
    }
  }
  return storedContent;
}

/**
 * Maps a database chapter to frontend representation.
 * If the database stored an HTML Mini App with 'interactive', maps it to 'html_app'.
 */
export function fromDbChapter<T extends Partial<Chapter>>(ch: T): T {
  if (isHtmlAppChapter(ch)) {
    return {
      ...ch,
      content_type: 'html_app',
      rich_text: extractHtmlAppContent(ch.rich_text)
    };
  }
  return ch;
}
