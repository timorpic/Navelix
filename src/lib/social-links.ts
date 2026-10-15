import type { SystemConfig } from "../types/index.ts";

export interface AccountSocialLink { label: string; href: string }

export function accountSocialLinks(config: Partial<SystemConfig>): AccountSocialLink[] {
  if (config.socialLinksEnabled === false) return [];
  const links: AccountSocialLink[] = [];
  const destinations: [string, string | undefined][] = [["GitHub", config.socialGithub], ["X", config.socialX], ["LinkedIn", config.socialLinkedin]];
  for (const [label, value] of destinations) {
    const raw = value?.trim();
    if (!raw || /[\r\n]/.test(raw)) continue;
    try {
      const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(raw) ? raw : `https://${raw}`);
      if (["https:", "http:"].includes(url.protocol) && !url.username && !url.password) links.push({ label, href: url.href });
    } catch { /* Omit malformed destinations. */ }
  }
  const email = config.socialEmail?.trim().replace(/^mailto:/i, "");
  if (email && /^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(email)) links.push({ label: "Email", href: `mailto:${email}` });
  return links;
}
