"use client";

import { useState, FormEvent } from "react";

const MAX_IMAGES = 10;

type Status =
  | { state: "idle" }
  | { state: "uploading" }
  | { state: "publishing" }
  | { state: "success"; postId: string }
  | { state: "error"; message: string };

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [caption, setCaption] = useState("");
  const [status, setStatus] = useState<Status>({ state: "idle" });
  const [uploadedPaths, setUploadedPaths] = useState<string[] | null>(null);

  // Upload files immediately on selection → extract recipes → fill caption
  async function addFiles(newFiles: FileList | null) {
    if (!newFiles || newFiles.length === 0) return;

    const incoming = Array.from(newFiles);
    const combined = [...files, ...incoming].slice(0, MAX_IMAGES);

    setFiles(combined);
    setPreviews(combined.map((f) => URL.createObjectURL(f)));

    // Upload all files to extract EXIF recipes
    setStatus({ state: "uploading" });
    const formData = new FormData();
    for (const file of combined) {
      formData.append("files", file);
    }

    try {
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const uploadData = await uploadRes.json();

      if (!uploadRes.ok) {
        setStatus({ state: "error", message: uploadData.error });
        return;
      }

      setUploadedPaths(uploadData.imagePaths);

      // Auto-fill caption from recipes if caption is empty
      if (!caption) {
        const recipes: (string | null)[] = uploadData.recipes ?? [];
        const uniqueRecipes = new Map<string, number[]>();

        recipes.forEach((recipe: string | null, i: number) => {
          if (!recipe) return;
          const existing = uniqueRecipes.get(recipe);
          if (existing) {
            existing.push(i + 1);
          } else {
            uniqueRecipes.set(recipe, [i + 1]);
          }
        });

        if (uniqueRecipes.size === 1) {
          // All images share the same recipe — show it plain
          setCaption([...uniqueRecipes.keys()][0]);
        } else if (uniqueRecipes.size > 1) {
          // Multiple recipes — group images by recipe
          const parts: string[] = [];
          for (const [recipe, imageNums] of uniqueRecipes) {
            const label = imageNums.length === 1
              ? `Image ${imageNums[0]}`
              : `Images ${imageNums.join(", ")}`;
            const simName = recipe.split("\n")[0];
            parts.push(`${label} (${simName}):\n${recipe}`);
          }
          setCaption(parts.join("\n\n---\n\n"));
        }
      }

      setStatus({ state: "idle" });
    } catch (err) {
      setStatus({
        state: "error",
        message: err instanceof Error ? err.message : "Upload failed",
      });
    }
  }

  function removeFile(index: number) {
    const next = files.filter((_, i) => i !== index);
    setFiles(next);
    setPreviews(next.map((f) => URL.createObjectURL(f)));
    if (next.length === 0) {
      setUploadedPaths(null);
    }
  }

  function moveFile(from: number, to: number) {
    if (to < 0 || to >= files.length) return;
    const next = [...files];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setFiles(next);
    setPreviews(next.map((f) => URL.createObjectURL(f)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!uploadedPaths || uploadedPaths.length === 0) {
      setStatus({ state: "error", message: "Please select at least one image." });
      return;
    }

    setStatus({ state: "publishing" });

    try {
      const publishRes = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagePaths: uploadedPaths, caption }),
      });
      const publishData = await publishRes.json();

      if (!publishRes.ok) {
        setStatus({ state: "error", message: publishData.error });
        return;
      }

      setStatus({ state: "success", postId: publishData.postId });
      setFiles([]);
      setPreviews([]);
      setCaption("");
      setUploadedPaths(null);
    } catch (err) {
      setStatus({
        state: "error",
        message: err instanceof Error ? err.message : "Something went wrong",
      });
    }
  }

  const isProcessing =
    status.state === "uploading" || status.state === "publishing";

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950 p-4">
      <div className="w-full max-w-lg space-y-6">
        <h1 className="text-2xl font-bold text-white text-center">
          Publish to Instagram
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* File picker */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Images
              <span className="text-xs text-gray-600 ml-2">
                ({files.length}/{MAX_IMAGES})
              </span>
            </label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(e) => addFiles(e.target.files)}
              className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-gray-800 file:text-white hover:file:bg-gray-700"
            />
          </div>

          {/* Image previews */}
          {previews.length > 0 && (
            <div className="grid grid-cols-5 gap-2">
              {previews.map((src, i) => (
                <div key={i} className="relative group">
                  <img
                    src={src}
                    alt={`Preview ${i + 1}`}
                    className="w-full aspect-square object-cover rounded"
                  />
                  <div className="absolute top-0 right-0 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {i > 0 && (
                      <button
                        type="button"
                        onClick={() => moveFile(i, i - 1)}
                        className="bg-black/70 text-white text-xs px-1 rounded-bl"
                      >
                        ←
                      </button>
                    )}
                    {i < files.length - 1 && (
                      <button
                        type="button"
                        onClick={() => moveFile(i, i + 1)}
                        className="bg-black/70 text-white text-xs px-1"
                      >
                        →
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="bg-red-600/80 text-white text-xs px-1 rounded-tr"
                    >
                      ×
                    </button>
                  </div>
                  <span className="absolute bottom-0 left-0 bg-black/70 text-white text-xs px-1 rounded-tr">
                    {i + 1}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Caption */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Caption</label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={5}
              className="w-full rounded bg-gray-900 border border-gray-700 p-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              placeholder="Write a caption... (auto-filled from Fujifilm recipe if detected)"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isProcessing || !uploadedPaths}
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
