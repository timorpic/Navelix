import type { Category, SiteLink } from "@/types";

export interface ParsedBookmarks {
  categories: Category[];
  links: SiteLink[];
}

export function parseBookmarksHTML(html: string): ParsedBookmarks {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const categories: Category[] = [];
  const links: SiteLink[] = [];
  const seenCat = new Set<string>();
  const seenUrl = new Set<string>();

  const getCategory = (name: string): Category => {
    const key = name.toLowerCase();
    const existing = categories.find((c) => c.name.toLowerCase() === key);
    if (existing) return existing;
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const cat: Category = {
      id: `${slug || "imported"}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      label: name.slice(0, 3),
      icon: "📁",
      color: "#00C776",
    };
    seenCat.add(key);
    categories.push(cat);
    return cat;
  };

  const walk = (dl: Element | null, folderName: string | null) => {
    if (!dl) return;
    for (const dt of Array.from(dl.children).filter(
      (el) => el.tagName === "DT",
    )) {
      const h3 = dt.querySelector(":scope > h3");
      const a = dt.querySelector(":scope > a[href]");
      if (h3) {
        const name = h3.textContent?.trim() || "Imported";
        const childDl = dt.querySelector(":scope > dl");
        walk(childDl, name);
      } else if (a) {
        const url = a.getAttribute("href");
        if (!url || seenUrl.has(url.toLowerCase())) continue;
        seenUrl.add(url.toLowerCase());
        const title = a.textContent?.trim() || url;
        const catName = folderName || "Imported";
        const cat = getCategory(catName);
        links.push({
          id: crypto.randomUUID(),
          title,
          url,
          description: "",
          category: cat.id,
          icon: "",
        });
      }
    }
  };

  walk(doc.querySelector("dl"), null);
  return { categories, links };
}
