"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

type Post = {
  id: string;
  caption: string | null;
  mediaUrl: string;
  timestamp: string;
  mediaType: string;
  permalink: string;
  likes: number;
  saves: number;
  reach: number;
  comments: number;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function PostRow({ post }: { post: Post }) {
  const captionSnippet = post.caption
    ? post.caption.split("\n")[0].slice(0, 60)
    : "No caption";

  return (
    <a
      href={post.permalink}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-3 items-center bg-gray-900 rounded-lg p-3 hover:bg-gray-800 transition-colors"
    >
      <div className="relative w-10 h-10 flex-shrink-0">
        <Image
          src={post.mediaUrl}
          alt={captionSnippet}
          fill
          unoptimized
          className="object-cover rounded"
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm truncate">{captionSnippet}</p>
        <p className="text-gray-500 text-xs mt-0.5">{formatDate(post.timestamp)}</p>
      </div>
      <div className="text-right flex-shrink-0 space-y-0.5">
        <p className="text-gray-400 text-xs">
          ♥ {formatCount(post.likes)} &nbsp; 🔖 {formatCount(post.saves)}
        </p>
        <p className="text-gray-600 text-xs">reach {formatCount(post.reach)}</p>
      </div>
    </a>
  );
}

function Skeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="flex gap-3 items-center bg-gray-900 rounded-lg p-3 animate-pulse"
        >
          <div className="w-10 h-10 bg-gray-800 rounded flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-gray-800 rounded w-3/4" />
            <div className="h-2 bg-gray-800 rounded w-1/3" />
          </div>
          <div className="space-y-1">
            <div className="h-2 bg-gray-800 rounded w-16" />
            <div className="h-2 bg-gray-800 rounded w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function HistoryTab() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/posts")
      .then((r) => {
        if (!r.ok) throw new Error(`Request failed: ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setPosts(data.posts);
        setStatus("success");
      })
      .catch((err) => {
        setError(err.message);
        setStatus("error");
      });
  }, []);

  if (status === "loading") return <Skeleton />;
  if (status === "error") return (
    <p className="text-red-400 text-sm">{error}</p>
  );
  if (posts.length === 0) return (
    <p className="text-gray-500 text-sm">No posts yet.</p>
  );

  return (
    <div className="space-y-2">
      {posts.map((post) => (
        <PostRow key={post.id} post={post} />
      ))}
    </div>
  );
}
