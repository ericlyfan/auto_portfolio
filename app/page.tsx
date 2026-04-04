"use client";

import { useState, FormEvent } from "react";

type Status =
  | { state: "idle" }
  | { state: "uploading" }
  | { state: "publishing" }
  | { state: "success"; postId: string }
  | { state: "error"; message: string };

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [status, setStatus] = useState<Status>({ state: "idle" });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!file) {
      setStatus({ state: "error", message: "Please select an image." });
      return;
    }

    try {
      // Step 1: Upload
      setStatus({ state: "uploading" });
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const uploadData = await uploadRes.json();

      if (!uploadRes.ok) {
        setStatus({ state: "error", message: uploadData.error });
        return;
      }

      // Step 2: Publish
      setStatus({ state: "publishing" });
      const publishRes = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imagePath: uploadData.imagePath,
          caption,
        }),
      });
      const publishData = await publishRes.json();

      if (!publishRes.ok) {
        setStatus({ state: "error", message: publishData.error });
        return;
      }

      setStatus({ state: "success", postId: publishData.postId });
      setFile(null);
      setCaption("");
    } catch (err) {
      setStatus({
        state: "error",
        message: err instanceof Error ? err.message : "Something went wrong",
      });
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950 p-4">
      <div className="w-full max-w-md space-y-6">
        <h1 className="text-2xl font-bold text-white text-center">
          Publish to Instagram
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Image
              <span className="text-xs text-gray-600 ml-2">
                (1:1, 4:5, or 1.91:1)
              </span>
            </label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-gray-800 file:text-white hover:file:bg-gray-700"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Caption</label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={3}
              className="w-full rounded bg-gray-900 border border-gray-700 p-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Write a caption..."
            />
          </div>

          <button
            type="submit"
            disabled={status.state === "uploading" || status.state === "publishing"}
            className="w-full py-2 rounded bg-blue-600 text-white font-semibold hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status.state === "uploading"
              ? "Uploading..."
              : status.state === "publishing"
                ? "Publishing..."
                : "Publish"}
          </button>
        </form>

        {status.state === "success" && (
          <div className="rounded bg-green-900/50 border border-green-700 p-3 text-sm text-green-300">
            Published successfully! Post ID: {status.postId}
          </div>
        )}

        {status.state === "error" && (
          <div className="rounded bg-red-900/50 border border-red-700 p-3 text-sm text-red-300">
            {status.message}
          </div>
        )}
      </div>
    </main>
  );
}
