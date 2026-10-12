import sourceIndex from "../../messages/source-index.json" with { type: "json" };
import templates from "../../messages/templates.json" with { type: "json" };

export type TextTranslator = (key: string, values?: Record<string, string | number>) => string;
const keys: Record<string, string> = sourceIndex;
const patterns = templates.map(({ source, key, translateValues = [] }) => ({
  key,
  translateValues,
  regex: new RegExp("^" + source.split(/\{v\d+\}/).map(part => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("([\\s\\S]*?)") + "$"),
}));

/** Only call for application labels/messages, never arbitrary user content. */
export function localizeText(source: string, translate: TextTranslator): string {
  if (keys[source]) return translate(keys[source]);
  for (const { key, regex, translateValues } of patterns) {
    const match = source.match(regex);
    if (match) return translate(key, Object.fromEntries(match.slice(1).map((value, i) => [`v${i}`, translateValues.includes(`v${i}`) ? localizeText(value, translate) : value])));
  }
  const prefix = source.match(/^((?:🎉|❌|✅|⚠️)\s*)([\s\S]+)$/u);
  if (prefix) return prefix[1] + localizeText(prefix[2], translate);
  return source;
}
