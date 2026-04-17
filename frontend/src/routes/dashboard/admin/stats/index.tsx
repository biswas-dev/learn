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
    <div style="padding: 32px; max-width: 900px;">
      <h1 style="font-size: 20px; font-weight: 700; color: #f1f5f9; margin-bottom: 28px;">System Stats</h1>

      {loading.value && <p style="color: #7c8ca8;">Loading...</p>}

      {s && v && (
        <>
          {/* Storage cards */}
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px;">
            <div style="background: linear-gradient(135deg, rgba(129,140,248,0.12), rgba(129,140,248,0.03)); border: 1px solid rgba(129,140,248,0.3); border-radius: 12px; padding: 20px;">
              <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #818cf8; opacity: 0.8;">Total Size</div>
              <div style="font-size: 28px; font-weight: 700; color: #818cf8; margin-top: 4px;">{s.total_size}</div>
              <div style="font-size: 11px; color: #7c8ca8; margin-top: 8px;">DB {s.db_size} + Images {s.image_size}</div>
            </div>
            <div style="background: #141621; border: 1px solid #1e2235; border-radius: 12px; padding: 20px;">
              <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #7c8ca8;">Database</div>
              <div style="font-size: 28px; font-weight: 700; color: #f1f5f9; margin-top: 4px;">{s.db_size}</div>
              <div style="font-size: 11px; color: #7c8ca8; margin-top: 8px;">{s.content_size} page content</div>
            </div>
            <div style="background: #141621; border: 1px solid #1e2235; border-radius: 12px; padding: 20px;">
              <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #7c8ca8;">Images</div>
              <div style="font-size: 28px; font-weight: 700; color: #f1f5f9; margin-top: 4px;">{s.image_size}</div>
              <div style="font-size: 11px; color: #7c8ca8; margin-top: 8px;">{s.image_count.toLocaleString()} files</div>
            </div>
            <div style="background: #141621; border: 1px solid #1e2235; border-radius: 12px; padding: 20px;">
              <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #7c8ca8;">Est. Reading</div>
              <div style="font-size: 28px; font-weight: 700; color: #f1f5f9; margin-top: 4px;">{Math.round(s.pages * 3 / 60)}h</div>
              <div style="font-size: 11px; color: #7c8ca8; margin-top: 8px;">{s.pages.toLocaleString()} pages total</div>
            </div>
          </div>

          {/* Content + Averages */}
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px;">
            <div style="background: #141621; border: 1px solid #1e2235; border-radius: 12px; padding: 24px;">
              <h2 style="font-size: 13px; font-weight: 600; color: #f1f5f9; margin-bottom: 16px;">Content</h2>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px 24px;">
                <StatRow label="Courses" value={s.courses} />
                <StatRow label="Sections" value={s.sections} />
                <StatRow label="Pages" value={s.pages} />
                <StatRow label="Tags" value={s.tags} />
                <StatRow label="Users" value={s.users} />
                <StatRow label="Page Versions" value={s.page_versions} />
                <StatRow label="Progress" value={s.progress_entries} />
                <StatRow label="Comments" value={s.comments} />
              </div>
            </div>

            <div style="background: #141621; border: 1px solid #1e2235; border-radius: 12px; padding: 24px;">
              <h2 style="font-size: 13px; font-weight: 600; color: #f1f5f9; margin-bottom: 16px;">Averages</h2>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px 24px;">
                <StatRow label="Sections / Course" value={s.courses > 0 ? Math.round(s.sections / s.courses) : 0} />
                <StatRow label="Pages / Course" value={s.courses > 0 ? Math.round(s.pages / s.courses) : 0} />
                <StatRow label="Images / Course" value={s.courses > 0 ? Math.round(s.image_count / s.courses) : 0} />
                <StatRow label="KB / Page" value={s.pages > 0 ? Math.round(s.content_size_bytes / s.pages / 1024) : 0} />
                <StatRow label="KB / Image" value={s.image_count > 0 ? Math.round(s.image_size_bytes / s.image_count / 1024) : 0} />
                <StatRow label="Versions / Page" value={s.pages > 0 ? Number((s.page_versions / s.pages).toFixed(1)) : 0} />
              </div>
            </div>
          </div>

          {/* Server */}
          <div style="background: #141621; border: 1px solid #1e2235; border-radius: 12px; padding: 24px;">
            <h2 style="font-size: 13px; font-weight: 600; color: #f1f5f9; margin-bottom: 16px;">Server</h2>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0 32px;">
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
            </div>
          </div>
        </>
      )}
    </div>
  );
});

const StatRow = component$<{ label: string; value: number }>(({ label, value }) => (
  <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 6px 0; border-bottom: 1px solid rgba(30,34,53,0.5);">
    <span style="font-size: 12px; color: #7c8ca8;">{label}</span>
    <span style="font-size: 14px; font-weight: 600; color: #f1f5f9; font-variant-numeric: tabular-nums;">{value.toLocaleString()}</span>
  </div>
));

const ServerRow = component$<{ label: string; value: string }>(({ label, value }) => (
  <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 8px 0; border-bottom: 1px solid rgba(30,34,53,0.5);">
    <span style="font-size: 12px; color: #7c8ca8;">{label}</span>
    <span style="font-size: 12px; font-family: monospace; color: #f1f5f9;">{value}</span>
  </div>
));
