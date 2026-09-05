"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiClientError } from "@/lib/api";

const DEFAULT_OPTIONS = {
  maxPages: 50,
  maxDepth: 3,
  autoScroll: true,
  screenshots: true,
  networkInspection: true,
  assetDiscovery: true,
  responsiveInspection: true,
  aiAnalysis: true,
};

type OptionKey = keyof typeof DEFAULT_OPTIONS;

const TOGGLE_OPTIONS: { key: OptionKey; label: string }[] = [
  { key: "autoScroll", label: "Auto-scroll" },
  { key: "screenshots", label: "Screenshots" },
  { key: "networkInspection", label: "Network inspection" },
  { key: "assetDiscovery", label: "Asset discovery" },
  { key: "responsiveInspection", label: "Responsive inspection" },
  { key: "aiAnalysis", label: "AI analysis" },
];

export default function NewProjectPage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [options, setOptions] = useState(DEFAULT_OPTIONS);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const project = await api.createProject({ url, options });
      router.push(`/projects/${project.id}`);
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to create project",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="mb-6 text-lg font-semibold">New project</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div>
          <label className="mb-1 block text-sm text-white/70">Website URL</label>
          <input
            type="url"
            required
            placeholder="https://example.com"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <p className="mt-1 text-xs text-white/40">
            Only inspect sites you own or are authorized to analyze.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm text-white/70">Maximum pages</label>
            <input
              type="number"
              min={1}
              max={500}
              value={options.maxPages}
              onChange={(event) =>
                setOptions((prev) => ({ ...prev, maxPages: Number(event.target.value) }))
              }
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-white/70">Maximum crawl depth</label>
            <input
              type="number"
              min={0}
              max={10}
              value={options.maxDepth}
              onChange={(event) =>
                setOptions((prev) => ({ ...prev, maxDepth: Number(event.target.value) }))
              }
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm text-white/70">Options</p>
          <div className="grid grid-cols-2 gap-2">
            {TOGGLE_OPTIONS.map((option) => (
              <label
                key={option.key}
                className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={options[option.key] as boolean}
                  onChange={(event) =>
                    setOptions((prev) => ({ ...prev, [option.key]: event.target.checked }))
                  }
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>

        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {submitting ? "Creating…" : "Start analysis"}
        </button>
      </form>
    </div>
  );
}
