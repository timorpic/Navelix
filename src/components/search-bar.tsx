"use client";

import { useState, useEffect } from "react";

const ENGINES = [
  { id: "google", name: "Google", url: "https://www.google.com/search?q=" },
  { id: "bing", name: "Bing", url: "https://www.bing.com/search?q=" },
  { id: "baidu", name: "Baidu", url: "https://www.baidu.com/s?wd=" },
  { id: "duckduckgo", name: "DuckDuckGo", url: "https://duckduckgo.com/?q=" },
  { id: "github", name: "GitHub", url: "https://github.com/search?q=" },
];

const ENGINE_KEY = "navelix.search-engine.v1";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export default function SearchBar({ value, onChange }: SearchBarProps) {
  const [engine, setEngine] = useState("google");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(ENGINE_KEY);
      if (saved && ENGINES.some((e) => e.id === saved)) {
        setEngine(saved);
      }
    } catch {}
  }, []);

  const handleEngineChange = (id: string) => {
    setEngine(id);
    localStorage.setItem(ENGINE_KEY, id);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = value.trim();
    if (!query) return;
    const target = ENGINES.find((en) => en.id === engine) ?? ENGINES[0];
    window.open(target.url + encodeURIComponent(query), "_blank");
  };

  return (
    <form onSubmit={handleSubmit} className="relative w-full max-w-2xl">
      <div className="relative flex items-center">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </div>
        <input
          id="main-search-input"
          name="search"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label="搜索"
          placeholder="Search anything..."
          className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 pl-12 pr-44 text-sm text-gray-900 placeholder-gray-400 transition-all focus:border-[#00C776] focus:outline-none focus:ring-2 focus:ring-[#00C776]/30"
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-2">
          <select
            name="search-engine"
            value={engine}
            onChange={(e) => handleEngineChange(e.target.value)}
            aria-label="Search engine"
            className="h-7 rounded-md border border-gray-200 bg-white px-1.5 text-[11px] font-medium text-gray-500 transition-colors focus:border-[#00C776] focus:outline-none"
          >
            {ENGINES.map((en) => (
              <option key={en.id} value={en.id}>
                {en.name}
              </option>
            ))}
          </select>
          <span className="rounded-md border border-gray-200 bg-white px-2 py-1 font-mono text-[11px] text-gray-400">
            ⌘K
          </span>
          <button
            type="submit"
            className="h-8 rounded-lg bg-[#00C776] px-4 text-sm font-medium text-white transition-colors hover:bg-[#009a5a]"
          >
            Search
          </button>
        </div>
      </div>
    </form>
  );
}
