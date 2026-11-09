/**
 * Job titles in the Feishu directory are in Chinese, but the signature is English.
 * Add new entries here as Chinese -> English. Untranslated Chinese titles are logged
 * (see `wrangler tail`) and left blank so staff type their own title.
 */
export const TITLE_TRANSLATIONS: Record<string, string> = {
  // Network / fleet management team
  网络管理: 'Fleet Management',
};

/** CJK ideographs, CJK punctuation and full-width forms */
const CJK = /[　-〿㐀-䶿一-鿿豈-﫿＀-￯]/;

const lookup = new Map<string, string>();
for (const [zh, en] of Object.entries(TITLE_TRANSLATIONS)) {
  lookup.set(zh.trim(), en);
  lookup.set(zh.replace(/\s+/g, ''), en);
}

/**
 * Returns the English title for a Feishu job title. Titles without Chinese characters
 * (e.g. "O&M") are returned as is; unknown Chinese titles return "" so the form is not
 * filled with Chinese text.
 */
export function translateTitle(raw: string): string {
  // \s also matches the full-width space U+3000; collapse runs to one ASCII space
  const text = raw.replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const match = lookup.get(text) ?? lookup.get(text.replace(/\s+/g, ''));
  if (match) return match;
  if (!CJK.test(text)) return text;
  console.warn(`[feishu] untranslated job title: ${raw}`);
  return '';
}
