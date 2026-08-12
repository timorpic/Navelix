"use client";

import React, { useState, useMemo } from "react";
import type { Category, SiteLink } from "@/types";
import { recordLinkUsage } from "@/lib/link-usage";

interface KnowledgeGraphProps {
  categories: Category[];
  links: SiteLink[];
}

export default function KnowledgeGraph({
  categories,
  links,
}: KnowledgeGraphProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [hoveredLinkId, setHoveredLinkId] = useState<string | null>(null);

  // Active Category Name & Icon
  const activeCatObj = categories.find((c) => c.id === activeCategory);
  const centerTitle = activeCatObj ? activeCatObj.name : "知识图谱";
  const centerIcon = activeCatObj ? activeCatObj.icon : "✨";

  // Filter links for graph visualization
  const graphLinks = useMemo(() => {
    let list = links;
    if (activeCategory) {
      list = links.filter((l) => l.category === activeCategory);
    }
    // Return max 8-10 satellite nodes for optimal constellation visualization layout
    return list.slice(0, 9);
  }, [links, activeCategory]);

  // Color palette for glowing orb nodes
  const orbColors = [
    { dot: "bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.9)]", line: "rgba(34,211,238,0.4)" },
    { dot: "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]", line: "rgba(52,211,153,0.4)" },
    { dot: "bg-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.9)]", line: "rgba(56,189,248,0.4)" },
    { dot: "bg-purple-400 shadow-[0_0_12px_rgba(192,132,252,0.9)]", line: "rgba(192,132,252,0.4)" },
    { dot: "bg-[#00C776] shadow-[0_0_12px_rgba(0,199,118,0.9)]", line: "rgba(0,199,118,0.4)" },
    { dot: "bg-teal-300 shadow-[0_0_12px_rgba(45,212,191,0.9)]", line: "rgba(45,212,191,0.4)" },
  ];

  // Calculate polar coordinates (x, y percentages) for constellation nodes
  const nodePositions = useMemo(() => {
    const total = graphLinks.length;
    if (total === 0) return [];

    const radiusX = 36; // horizontal radius %
    const radiusY = 34; // vertical radius %

    return graphLinks.map((link, idx) => {
      const angle = (2 * Math.PI * idx) / total - Math.PI / 2;
      const x = 50 + radiusX * Math.cos(angle);
      const y = 50 + radiusY * Math.sin(angle);
      const color = orbColors[idx % orbColors.length];
      return { link, x, y, color };
    });
  }, [graphLinks]);

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Category Node Switcher Pills */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          onClick={() => setActiveCategory(null)}
          className={`px-2.5 py-0.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
            activeCategory === null
              ? "bg-[#00C776] text-white shadow-xs"
              : "bg-gray-100 dark:bg-slate-900 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700"
          }`}
        >
          全部分类 ({links.length})
        </button>
        {categories.map((c) => {
          const isSelected = activeCategory === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setActiveCategory(isSelected ? null : c.id)}
              className={`px-2.5 py-0.5 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                isSelected
                  ? "bg-[#00C776] text-white shadow-xs"
                  : "bg-gray-100 dark:bg-slate-900 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700"
              }`}
            >
              <span>{c.icon || "📌"}</span>
              <span>{c.name}</span>
            </button>
          );
        })}
      </div>

      {/* Constellation Network Canvas Container */}
      <div className="relative flex-1 min-h-[250px] w-full bg-[#0d121d] dark:bg-[#0b0f19] rounded-2xl border border-slate-800 overflow-hidden select-none">
        {/* Ambient Glow Gradient Background */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,199,118,0.08)_0%,transparent_70%)] pointer-events-none" />

        {/* SVG Constellation Web Connection Lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
          {/* Center to node lines */}
          {nodePositions.map((pos) => {
            const isHovered = hoveredLinkId === pos.link.id;
            return (
              <line
                key={`line-center-${pos.link.id}`}
                x1="50%"
                y1="50%"
                x2={`${pos.x}%`}
                y2={`${pos.y}%`}
                stroke={isHovered ? pos.color.line : "rgba(255, 255, 255, 0.12)"}
                strokeWidth={isHovered ? "1.8" : "1"}
                strokeDasharray={isHovered ? "none" : "3 3"}
                className="transition-all duration-200"
              />
            );
          })}

          {/* Inter-node constellation web lines */}
          {nodePositions.map((pos, idx) => {
            const nextPos = nodePositions[(idx + 1) % nodePositions.length];
            return (
              <line
                key={`line-web-${idx}`}
                x1={`${pos.x}%`}
                y1={`${pos.y}%`}
                x2={`${nextPos.x}%`}
                y2={`${nextPos.y}%`}
                stroke="rgba(255, 255, 255, 0.08)"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
            );
          })}
        </svg>

        {/* Central Core Hub Node */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-gradient-to-r from-purple-900/90 to-indigo-900/90 border border-purple-400/40 text-white shadow-[0_0_25px_rgba(168,85,247,0.5)] backdrop-blur-md">
          <span className="text-base animate-pulse">{centerIcon}</span>
          <span className="text-xs font-black tracking-wide truncate max-w-[90px]">
            {centerTitle}
          </span>
        </div>

        {/* Orbital Constellation Satellite Nodes */}
        {nodePositions.map((pos) => {
          const isHovered = hoveredLinkId === pos.link.id;

          return (
            <div
              key={pos.link.id}
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-10 flex items-center gap-1.5 group cursor-pointer"
              onMouseEnter={() => setHoveredLinkId(pos.link.id)}
              onMouseLeave={() => setHoveredLinkId(null)}
            >
              <a
                href={pos.link.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => recordLinkUsage(pos.link.id)}
                className="flex items-center gap-1.5"
              >
                {/* Glowing Orb Dot */}
                <span
                  className={`w-3.5 h-3.5 rounded-full transition-transform duration-200 ${
                    pos.color.dot
                  } ${isHovered ? "scale-130 ring-2 ring-white/60" : "scale-100"}`}
                />

                {/* Translucent Glass Pill Label */}
                <div
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-all duration-200 backdrop-blur-md border ${
                    isHovered
                      ? "bg-[#00C776] text-white border-[#00C776] shadow-[0_0_15px_rgba(0,199,118,0.6)]"
                      : "bg-slate-900/80 text-slate-200 border-slate-700/80 group-hover:border-slate-500"
                  }`}
                >
                  {pos.link.title}
                </div>
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
