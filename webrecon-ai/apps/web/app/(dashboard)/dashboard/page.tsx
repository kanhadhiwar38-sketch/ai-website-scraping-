"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Project } from "@webrecon/types";

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-xs text-white/50">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {hint ? <p className="mt-1 text-xs text-white/30">{hint}</p> : null}
    </div>
  );
}

export default function DashboardPage() {
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
      <h1 className="mb-6 text-lg font-semibold">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Projects" value={projects ? String(projects.length) : "…"} />
        <StatCard label="Active browser sessions" value="0" hint="Phase 2" />
        <StatCard label="Running jobs" value="0" hint="Phase 7" />
        <StatCard label="Failed jobs" value="0" hint="Phase 7" />
        <StatCard label="Completed jobs" value="0" hint="Phase 7" />
        <StatCard label="AI usage (requests)" value="0" hint="Phase 9" />
        <StatCard label="Estimated AI cost" value="$0.00" hint="Phase 9" />
        <StatCard label="Worker status" value="—" hint="Phase 7" />
      </div>

      {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-sm font-medium text-white/70">Recent projects</h2>
        <Link href="/projects/new" className="text-sm text-primary hover:underline">
          + New project
        </Link>
      </div>

      <div className="mt-3 divide-y divide-border rounded-lg border border-border bg-surface">
        {projects === null ? (
          <p className="px-4 py-6 text-sm text-white/40">Loading…</p>
        ) : projects.length === 0 ? (
          <p className="px-4 py-6 text-sm text-white/40">
            No projects yet.{" "}
            <Link href="/projects/new" className="text-primary hover:underline">
              Create your first project
            </Link>
            .
          </p>
        ) : (
          projects.slice(0, 5).map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="flex items-center justify-between px-4 py-3 text-sm hover:bg-white/5"
            >
              <span className="truncate">{project.url}</span>
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
