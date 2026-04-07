"use client";

import { useState } from "react";
import PublishTab from "@/app/components/PublishTab";
import HistoryTab from "@/app/components/HistoryTab";
import StatsTab from "@/app/components/StatsTab";

type Tab = "publish" | "history" | "stats";

const TABS: { id: Tab; label: string }[] = [
  { id: "publish", label: "Publish" },
  { id: "history", label: "History" },
  { id: "stats", label: "Stats" },
];

export default function Home() {
  const [tab, setTab] = useState<Tab>("publish");

  return (
    <main className="min-h-screen bg-gray-950">
      <div className="flex border-b border-gray-800 sticky top-0 bg-gray-950 z-10">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-3 text-sm transition-colors ${
              tab === t.id
                ? "text-white border-b-2 border-blue-500"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-4 max-w-lg mx-auto">
        {tab === "publish" && <PublishTab />}
        {tab === "history" && <HistoryTab />}
        {tab === "stats" && <StatsTab />}
      </div>
    </main>
  );
}
