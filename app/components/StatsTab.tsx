"use client";

import { useState, useEffect } from "react";

type AccountData = {
  username: string;
  followersCount: number;
  mediaCount: number;
  reach28d: number;
  profileViews28d: number;
  tokenDaysLeft: number | null;
};

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-gray-900 rounded-lg p-4 text-center">
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
}

export default function StatsTab() {
  const [account, setAccount] = useState<AccountData | null>(null);
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/account")
      .then((r) => {
        if (!r.ok) throw new Error(`Request failed: ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setAccount(data);
        setStatus("success");
      })
      .catch((err) => {
        setError(err.message);
        setStatus("error");
      });
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    setNewToken(null);
    try {
      const res = await fetch("/api/instagram/refresh", { method: "POST" });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setNewToken(data.newToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-gray-900 rounded-lg h-20" />
          ))}
        </div>
      </div>
    );
  }

  if (status === "error") {
    return <p className="text-red-400 text-sm">{error}</p>;
  }

  if (!account) return null;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <p className="text-xs text-gray-500 uppercase tracking-wider">
          Account
        </p>
        <div className="grid grid-cols-2 gap-3">
          <StatTile
            value={formatCount(account.followersCount)}
            label="followers"
          />
          <StatTile
            value={formatCount(account.reach28d)}
            label="reach (28d)"
          />
          <StatTile
            value={formatCount(account.profileViews28d)}
            label="profile views"
          />
          <StatTile value={String(account.mediaCount)} label="posts" />
        </div>
      </div>

      <div className="border-t border-gray-800 pt-4 text-center">
        {account.tokenDaysLeft !== null ? (
          <p className="text-xs text-gray-500">
            Token expires in {account.tokenDaysLeft} days
          </p>
        ) : (
          <p className="text-xs text-gray-600">
            Set INSTAGRAM_TOKEN_ISSUED_AT in .env.local to track expiry
          </p>
        )}
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="mt-2 text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50"
        >
          {refreshing ? "Refreshing..." : "Refresh token"}
        </button>
        {newToken && (
          <div className="mt-3 bg-gray-900 border border-gray-700 rounded p-3 text-left">
            <p className="text-xs text-gray-400 mb-1">
              New token — copy to .env.local and update INSTAGRAM_TOKEN_ISSUED_AT:
            </p>
            <code className="text-xs text-green-400 break-all">{newToken}</code>
          </div>
        )}
      </div>
    </div>
  );
}
