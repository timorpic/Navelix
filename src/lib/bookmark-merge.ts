import type { Category, SiteLink } from "@/types";

export interface BookmarkMergeSummary {
  categories: number;
  links: number;
  skipped: number;
}

/** Preserve existing data, merge owned groups by name, and skip URLs already seen. */
export function mergeBookmarkData(
  categories: Category[], links: SiteLink[], importedCategories: Category[], importedLinks: SiteLink[],
) {
  const nextCategories = [...categories];
  const categoryIds = new Map<string, string>();
  for (const category of importedCategories) {
    const existing = nextCategories.find(c => !c.isSubscribed && c.name.trim().toLowerCase() === category.name.trim().toLowerCase());
    categoryIds.set(category.id, existing?.id ?? category.id);
    if (!existing) nextCategories.push(category);
  }
  const urls = new Set(links.map(link => link.url.toLowerCase()));
  const added: SiteLink[] = [];
  for (const link of importedLinks) {
    const url = link.url.toLowerCase();
    if (urls.has(url)) continue;
    urls.add(url);
    added.push({ ...link, category: categoryIds.get(link.category) ?? link.category });
  }
  return {
    categories: nextCategories,
    links: [...links, ...added],
    summary: { categories: nextCategories.length - categories.length, links: added.length, skipped: importedLinks.length - added.length },
  };
}
