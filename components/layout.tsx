"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icons, type IconName } from "./icons";
import { signOut } from "@/lib/actions/auth";

export interface SidebarMember {
  name: string;
  initials: string;
  role: "admin" | "editor" | "viewer";
}

const ROLE_LABEL: Record<SidebarMember["role"], string> = {
  admin: "Admin",
  editor: "Redaktör",
  viewer: "Läsbehörighet",
};

interface NavItem {
  id: string;
  label: string;
  icon: IconName;
  href: string;
  count?: number;
  alert?: boolean;
}

interface NavGroup {
  section: string;
  items: NavItem[];
}

export interface CrumbEntity {
  id: string;
  slug?: string;
  name: string;
}

function navGroups(customerCount: number, projectCount: number): NavGroup[] {
  return [
    {
      section: "Core",
      items: [
        { id: "dashboard", label: "Operations", icon: "Dashboard", href: "/dashboard" },
        { id: "customers", label: "Customers", icon: "Users", href: "/customers", count: customerCount },
        { id: "projects", label: "Projects", icon: "Cube", href: "/projects", count: projectCount },
        { id: "models", label: "Models", icon: "Brain", href: "/models" },
        { id: "tokens", label: "Token Usage", icon: "Coins", href: "/tokens" },
        { id: "incidents", label: "Incidents", icon: "Alert", href: "/incidents", alert: true },
      ],
    },
    {
      section: "Finance",
      items: [
        { id: "billing", label: "Billing & Revenue", icon: "Receipt", href: "/billing" },
        { id: "costs", label: "Costs", icon: "Wallet", href: "/costs" },
        { id: "reports", label: "Reports & Risk", icon: "Chart", href: "/reports" },
      ],
    },
    {
      section: "Admin",
      items: [
        { id: "wiki", label: "Wiki & Ideas", icon: "Book", href: "/wiki" },
        { id: "settings", label: "Settings", icon: "Settings", href: "/settings" },
      ],
    },
  ];
}

export function Sidebar({
  customerCount,
  projectCount,
  member,
}: {
  customerCount: number;
  projectCount: number;
  member: SidebarMember | null;
}) {
  const pathname = usePathname() ?? "/";
  const topSegment = pathname.split("/")[1] || "dashboard";

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-text">
          <span className="top">haus</span>
          <span className="sub">Operations Hub</span>
        </div>
      </div>
      {navGroups(customerCount, projectCount).map((group) => (
        <div className="nav-section" key={group.section}>
          <div className="nav-section-title">{group.section}</div>
          {group.items.map((it) => {
            const Icn = Icons[it.icon];
            const active = topSegment === it.id;
            return (
              <Link
                href={it.href}
                key={it.id}
                className={"nav-item" + (active ? " active" : "")}
              >
                <span className="nav-icon">
                  <Icn size={15} />
                </span>
                <span>{it.label}</span>
                {it.count != null && (
                  <span className="nav-count">{it.count}</span>
                )}
                {it.alert && it.count == null && (
                  <span className="nav-dot"></span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
      <div className="sidebar-foot">
        <div className="avatar">{member?.initials ?? "?"}</div>
        <div style={{ minWidth: 0, flex: 1, lineHeight: 1.2 }}>
          <div className="user-name">{member?.name ?? "Okänd"}</div>
          <div className="user-role">
            {member ? ROLE_LABEL[member.role] : "—"} · @haus.se
          </div>
        </div>
        <form action={signOut}>
          <button
            className="ws-chev"
            type="submit"
            title="Logga ut"
            aria-label="Logga ut"
            style={{ background: "none", border: 0, cursor: "pointer", padding: 4 }}
          >
            <Icons.Logout size={14} />
          </button>
        </form>
      </div>
    </aside>
  );
}

interface Crumb {
  label: string;
  href?: string;
}

const SECTION_LABEL: Record<string, string> = {
  dashboard: "Operations Dashboard",
  customers: "Customers",
  projects: "Projects",
  models: "Models",
  tokens: "Token Usage",
  incidents: "Incidents",
  billing: "Billing & Revenue",
  costs: "Costs",
  reports: "Reports & Risk",
  workflows: "Workflows & Tools",
  wiki: "Wiki & Ideas",
  settings: "Settings",
};

export function Topbar({
  customers,
  projects,
}: {
  customers: CrumbEntity[];
  projects: CrumbEntity[];
}) {
  const pathname = usePathname() ?? "/";
  const parts = pathname.split("/").filter(Boolean);

  const crumbs: Crumb[] = [{ label: "Haus AI", href: "/dashboard" }];
  if (parts.length === 0 || parts[0] === "dashboard") {
    crumbs.push({ label: "Operations" });
  } else {
    crumbs.push({
      label: SECTION_LABEL[parts[0]] ?? parts[0],
      href: "/" + parts[0],
    });
    if (parts[1]) {
      if (parts[0] === "customers") {
        const c = customers.find((x) => x.id === parts[1]);
        if (c) crumbs.push({ label: c.name, href: `/customers/${parts[1]}` });
      } else if (parts[0] === "projects") {
        const seg = parts[1];
        const bare = seg.replace(/^p-/, "");
        const p = projects.find(
          (x) => x.id === seg || x.slug === seg || x.slug === bare,
        );
        if (p) crumbs.push({ label: p.name, href: `/projects/${parts[1]}` });
      } else {
        crumbs.push({ label: parts[1] });
      }
    }
    if (parts[2]) {
      crumbs.push({ label: parts[2] });
    }
  }

  return (
    <header className="topbar">
      <div className="crumbs">
        {crumbs.map((c, i) => (
          <span key={i} style={{ display: "inline-flex", alignItems: "center" }}>
            {i > 0 && <span className="crumb-sep">›</span>}
            {c.href ? (
              <Link
                href={c.href}
                className={
                  "crumb" + (i === crumbs.length - 1 ? " current" : "")
                }
              >
                {c.label}
              </Link>
            ) : (
              <span
                className={
                  "crumb" + (i === crumbs.length - 1 ? " current" : "")
                }
              >
                {c.label}
              </span>
            )}
          </span>
        ))}
      </div>
      <div className="topbar-spacer"></div>
      <div className="topbar-search">
        <Icons.Search size={14} />
        <span>Sök kunder, projekt, modeller…</span>
        <span className="kbd">⌘K</span>
      </div>
      <button className="topbar-btn" title="Sync data" type="button">
        <Icons.Refresh size={16} />
      </button>
      <button className="topbar-btn" title="Notifications" type="button">
        <Icons.Bell size={16} />
        <span className="badge-dot"></span>
      </button>
    </header>
  );
}
