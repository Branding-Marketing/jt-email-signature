/**
 * Job titles in the Feishu directory are in Chinese, but the signature is English.
 * Add new entries here as Chinese -> English. Untranslated Chinese titles are logged
 * (see `wrangler tail`) and left blank so staff type their own title.
 */
export const TITLE_TRANSLATIONS: Record<string, string> = {
  // Seeded from the J&T Express Australia org chart.

  // Departments
  总经办: 'GM Office',
  // Network Management is called Fleet Management (see 网络管理 below)
  市场网管部: 'Marketing & Fleet Management Department',
  人资行政部: 'Human Resources & Administration Department',
  信息科技部: 'IT Department',
  财务部: 'Finance Department',
  营运部: 'Operations Department',

  // GM Office
  品牌管理: 'Branding',
  法律合规: 'Legal & Compliance',
  采购: 'Procurement',

  // Marketing & Fleet Management Department
  市场营销: 'Sales & Marketing',
  // The org chart says "Network Management"; "Fleet Management" is used on purpose
  网络管理: 'Fleet Management',
  市场拓展: 'Business Development',
  业务支持: 'Business Support',

  // Human Resources & Administration Department
  招聘: 'Recruitment',
  行政管理: 'Administration',
  薪酬绩效与员工关系: 'C&B, Performance and Employment Relations',
  组织与人才发展: 'Organisation & Talent Development',
  综合管理: 'General Affairs Management',

  // IT Department
  运维: 'Operations & Maintenance',
  产品: 'Product',
  运营: 'Product Operations',

  // Finance Department
  资金: 'Treasury',
  账务及结算: 'Settlement & Accounting',
  管理会计: 'Management Accounting',
  税务: 'Tax',

  // Operations Department
  规划: 'Planning',
  运力: 'Transport Capacity',
  质控: 'Quality Control',
  // Australian spelling "Centre" (the org chart says "Center")
  中心管理: 'Distribution Centre Management',
  客服: 'Customer Service',
  质控客服: 'Quality Control & Customer Service',
  转运中心: 'Distribution Centre',
  区域: 'Region',

  // Regions
  珀斯: 'Perth',
  悉尼: 'Sydney',
  布里斯班: 'Brisbane',
  墨尔本: 'Melbourne',
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
