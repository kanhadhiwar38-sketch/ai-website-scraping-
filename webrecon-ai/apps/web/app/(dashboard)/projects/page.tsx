"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Project } from "@webrecon/types";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listProjects()
      .then((res) => setProjects(res.projects))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load projects"));
  }, []);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Projects</h1>
        <Link
          href="/projects/new"
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white"
        >
          + New project
        </Link>
      </div>

      {error ? <p className="mb-4 text-sm text-red-400">{error}</p> : null}

      <div className="divide-y divide-border rounded-lg border border-border bg-surface">
        {projects === null ? (
          <p className="px-4 py-6 text-sm text-white/40">Loading…</p>
        ) : projects.length === 0 ? (
          <p className="px-4 py-6 text-sm text-white/40">No projects yet.</p>
        ) : (
          projects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="flex items-center justify-between px-4 py-3 text-sm hover:bg-white/5"
            >
              <div>
                <p className="truncate">{project.url}</p>
                <p className="mt-0.5 text-xs text-white/40">
                  {project.pagesScanned} pages scanned
                </p>
              </div>
              <span className="ml-4 shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-white/50">
                {project.status}
              </span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
