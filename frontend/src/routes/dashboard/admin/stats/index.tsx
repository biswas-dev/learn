import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { get } from "~/lib/api";

interface StorageStats {
  courses: number;
  sections: number;
  pages: number;
  tags: number;
  users: number;
  comments: number;
  page_versions: number;
  progress_entries: number;
  content_size: string;
  content_size_bytes: number;
  db_size: string;
  db_size_bytes: number;
  image_count: number;
  image_size: string;
  image_size_bytes: number;
  total_size: string;
  total_size_bytes: number;
}

interface SystemInfo {
  version: {
    backend: { version: string; git_commit: string; build_time: string; go_version: string; platform: string };
    runtime: { hostname: string; pid: number; port: number; uptime_seconds: number; started_at: string };
    database: string;
  };
  storage: StorageStats;
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

export default component$(() => {
  const data = useSignal<SystemInfo | null>(null);
  const loading = useSignal(true);

  useVisibleTask$(() => {
    get<SystemInfo>("/admin/system-info")
      .then((d) => { data.value = d; })
      .catch(() => {})
      .finally(() => { loading.value = false; });
  });

  const s = data.value?.storage;
  const v = data.value?.version;

  return (
    <div class="p-6 lg:px-8 lg:pb-16 max-w-[1100px]">
      {/* Page top */}
      <div class="flex items-center justify-between mb-[18px]">
        <div class="ln-breadcrumb">
          learn <span class="text-border-soft">/</span> admin <span class="text-border-soft">/</span> <b>stats</b>
        </div>
      </div>

      <div class="ln-greet">
        <h1>System Stats</h1>
      </div>

      {loading.value && (
        <div class="animate-pulse">
          <div class="ln-kpis" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
            {[1,2,3,4].map((i) => (
              <div key={i} class="ln-kpi"><div class="h-3 bg-border-soft rounded w-16 mb-2" /><div class="h-7 bg-border-soft rounded w-20" /></div>
            ))}
          </div>
        </div>
      )}

      {s && v && (
        <>
          {/* KPI cards */}
          <div class="ln-kpis" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
            <div class="ln-kpi">
              <div class="ln-kpi-label">Total Size</div>
              <div class="ln-kpi-value text-accent">{s.total_size}</div>
              <div class="ln-kpi-foot">DB {s.db_size} + Images {s.image_size}</div>
            </div>
            <div class="ln-kpi">
              <div class="ln-kpi-label">Database</div>
              <div class="ln-kpi-value">{s.db_size}</div>
              <div class="ln-kpi-foot">{s.content_size} page content</div>
            </div>
            <div class="ln-kpi">
              <div class="ln-kpi-label">Images</div>
              <div class="ln-kpi-value">{s.image_size}</div>
              <div class="ln-kpi-foot">{s.image_count.toLocaleString()} files</div>
            </div>
            <div class="ln-kpi">
              <div class="ln-kpi-label">Est. Reading</div>
              <div class="ln-kpi-value">{Math.round(s.pages * 3 / 60)}h</div>
              <div class="ln-kpi-foot">{s.pages.toLocaleString()} pages total</div>
            </div>
          </div>

          {/* Content + Averages */}
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div class="ln-panel">
              <div class="ln-panel-head">
                <h3>Content</h3>
              </div>
              <div class="ln-panel-body p0">
                <table class="ln-tbl">
                  <tbody>
                    <StatRow label="Courses" value={s.courses} />
                    <StatRow label="Sections" value={s.sections} />
                    <StatRow label="Pages" value={s.pages} />
                    <StatRow label="Tags" value={s.tags} />
                    <StatRow label="Users" value={s.users} />
                    <StatRow label="Page Versions" value={s.page_versions} />
                    <StatRow label="Progress" value={s.progress_entries} />
                    <StatRow label="Comments" value={s.comments} />
                  </tbody>
                </table>
              </div>
            </div>

            <div class="ln-panel">
              <div class="ln-panel-head">
                <h3>Averages</h3>
              </div>
              <div class="ln-panel-body p0">
                <table class="ln-tbl">
                  <tbody>
                    <StatRow label="Sections / Course" value={s.courses > 0 ? Math.round(s.sections / s.courses) : 0} />
                    <StatRow label="Pages / Course" value={s.courses > 0 ? Math.round(s.pages / s.courses) : 0} />
                    <StatRow label="Images / Course" value={s.courses > 0 ? Math.round(s.image_count / s.courses) : 0} />
                    <StatRow label="KB / Page" value={s.pages > 0 ? Math.round(s.content_size_bytes / s.pages / 1024) : 0} />
                    <StatRow label="KB / Image" value={s.image_count > 0 ? Math.round(s.image_size_bytes / s.image_count / 1024) : 0} />
                    <StatRow label="Versions / Page" value={s.pages > 0 ? Number((s.page_versions / s.pages).toFixed(1)) : 0} />
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Server */}
          <div class="ln-panel">
            <div class="ln-panel-head">
              <h3>Server</h3>
            </div>
            <div class="ln-panel-body p0">
              <table class="ln-tbl">
                <tbody>
                  <ServerRow label="Version" value={v.backend.version} />
                  <ServerRow label="Commit" value={v.backend.git_commit} />
                  <ServerRow label="Go" value={v.backend.go_version} />
                  <ServerRow label="Platform" value={v.backend.platform} />
                  <ServerRow label="Hostname" value={v.runtime.hostname} />
                  <ServerRow label="PID" value={String(v.runtime.pid)} />
                  <ServerRow label="Port" value={String(v.runtime.port)} />
                  <ServerRow label="Uptime" value={formatUptime(v.runtime.uptime_seconds)} />
                  <ServerRow label="Started" value={new Date(v.runtime.started_at).toLocaleString()} />
                  <ServerRow label="Database" value={v.database} />
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
});

const StatRow = component$<{ label: string; value: number }>(({ label, value }) => (
  <tr>
    <td class="text-muted text-[12.5px]">{label}</td>
    <td class="text-right font-mono text-[13px] font-medium tabular-nums">{value.toLocaleString()}</td>
  </tr>
));

const ServerRow = component$<{ label: string; value: string }>(({ label, value }) => (
  <tr>
    <td class="text-muted text-[12.5px]">{label}</td>
    <td class="text-right font-mono text-[12px]">{value}</td>
  </tr>
));
