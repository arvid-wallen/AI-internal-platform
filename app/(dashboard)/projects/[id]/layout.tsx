import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCustomer,
  getProject,
  listDependenciesForProject,
  listNotesForProject,
} from "@/lib/db";
import { fmt } from "@/lib/format";
import { Icons } from "@/components/icons";
import { Pill, StatusPill } from "@/components/ui";
import { TabsClient } from "./tabs-client";

export const dynamic = "force-dynamic";

export default async function ProjectDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = await getProject(id);
  if (!p) notFound();
  const [c, deps, notes] = await Promise.all([
    getCustomer(p.customer_id),
    listDependenciesForProject(p.id),
    listNotesForProject(p.id),
  ]);

  const tabs = [
    { id: "overview", label: "Overview", href: `/projects/${p.id}` },
    { id: "models", label: "Models", href: `/projects/${p.id}/models` },
    { id: "tokens", label: "Tokens", href: `/projects/${p.id}/tokens` },
    { id: "costs", label: "Costs", href: `/projects/${p.id}/costs` },
    {
      id: "dependencies",
      label: "Dependencies",
      href: `/projects/${p.id}/dependencies`,
      count: deps.length,
    },
    { id: "updates", label: "Updates", href: `/projects/${p.id}/updates` },
    {
      id: "notes",
      label: "Notes",
      href: `/projects/${p.id}/notes`,
      count: notes.length,
    },
  ];

  return (
    <div className="page">
      <div className="detail-head">
        <div className="left">
          {c && <div className={"detail-mark dm-" + c.mark}>{c.init}</div>}
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 4,
              }}
            >
              <h1 className="title">{p.name}</h1>
              <StatusPill status={p.status} />
              {!p.healthy && (
                <Pill kind="critical">Behöver uppmärksamhet</Pill>
              )}
            </div>
            <div className="meta">
              {c && (
                <Link
                  href={`/customers/${c.id}`}
                  style={{ color: "var(--c-ink-2)" }}
                >
                  {c.name}
                </Link>
              )}
              <span className="sep">·</span>
              <span>
                <Icons.Branch size={11} />{" "}
                <span className="tnum">{p.repo ?? "no repo"}</span>
              </span>
              <span className="sep">·</span>
              <span>
                <Icons.Server size={11} /> {p.hosting}
              </span>
              <span className="sep">·</span>
              <span>Ägs av {p.owner}</span>
              {p.go_live && (
                <>
                  <span className="sep">·</span>
                  <span>Go-live {fmt.date(p.go_live)}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="actions">
          <a
            className="b"
            href={p.repo ? `https://github.com/${p.repo}` : "#"}
            target="_blank"
            rel="noreferrer"
          >
            <Icons.Ext size={14} />
            Öppna i GitHub
          </a>
          <button className="b" type="button">
            <Icons.Edit size={14} />
            Redigera
          </button>
          <Link className="b primary" href={`/projects/${p.id}/models`}>
            <Icons.Brain size={14} />
            Byt modell
          </Link>
        </div>
      </div>

      <TabsClient tabs={tabs} />

      {children}
    </div>
  );
}
