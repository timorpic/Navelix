"use client";

import type { LinkStatus } from "@/hooks/use-link-status";
import type { SiteLink } from "@/types";
import LinkCard from "./link-card";

interface CardGridProps {
  links: SiteLink[];
  statuses?: Record<string, LinkStatus>;
}

export default function CardGrid({ links, statuses }: CardGridProps) {
  if (links.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <span className="mb-3 text-4xl">🔍</span>
        <p className="text-sm">No links found</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {links.map((link) => (
        <LinkCard key={link.id} link={link} status={statuses?.[link.id]} />
      ))}
    </div>
  );
}
