export function validateGuide(data) {
  if (!data || !Array.isArray(data.groups) || !data.groups.length ||
      !Array.isArray(data.tools) || !Array.isArray(data.pageTitles) ||
      !Array.isArray(data.categories) || !data.toolCategories || !data.labels ||
      !data.groups.every(group => Array.isArray(group.pages) && group.pages.every(page => Array.isArray(page.items)))) {
    throw new Error('這不是本講義的有效匯出檔，請從本機講義的「匯出」取得 HTML。');
  }
  const copy = JSON.parse(JSON.stringify(data));
  if (new TextEncoder().encode(JSON.stringify(copy)).length >= 900000) throw new Error('講義過大，請先縮小圖片再更新。');
  return copy;
}
export function parseGuide(text) {
  const match = text.match(/<script>\s*window\.guideConfig\s*=\s*(\{[\s\S]*?\});\s*<\/script>/);
  return validateGuide(JSON.parse(match ? match[1] : text));
}
