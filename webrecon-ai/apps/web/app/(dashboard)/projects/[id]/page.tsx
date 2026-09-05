"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import type { Project } from "@webrecon/types";

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getProject(params.id)
      .then(setProject)
      .catch((err) =>
        setError(err instanceof ApiClientError ? err.message : "Failed to load project"),
      );
  }, [params.id]);

  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (!project) return <p className="text-sm text-white/40">Loading…</p>;

  return (
    <div>
      <div className="mb-1 flex items-center gap-3">
        <h1 className="text-lg font-semibold">{project.url}</h1>
        <span className="rounded-full border border-border px-2 py-0.5 text-xs text-white/50">
          {project.status}
        </span>
      </div>
      <p className="mb-6 text-xs text-white/40">
        Allowed domains: {project.allowedDomains.join(", ")}
      </p>

      <div className="rounded-lg border border-border bg-surface p-4">
        <p className="mb-3 text-sm font-medium text-white/70">Analysis options</p>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          {Object.entries(project.options).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between border-b border-border/50 pb-1">
              <dt className="text-white/50">{key}</dt>
              <dd>{String(value)}</dd>
            </div>
          ))}
        </dl>
      </div>

      <p className="mt-6 text-sm text-white/40">
        Crawling, DOM/network inspection, screenshots, and AI analysis run as background
        jobs introduced in later phases (Phase 3 onward). This page will show live progress
        once the job queue (Phase 7) is wired up.
      </p>
    </div>
  );
}
