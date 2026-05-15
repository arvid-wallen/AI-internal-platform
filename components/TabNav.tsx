"use client";

import Link from "next/link";

export interface Tab {
  id: string;
  label: string;
  href: string;
  count?: number;
}

export function TabNav({ tabs, current }: { tabs: Tab[]; current: string }) {
  return (
    <div className="tabnav">
      {tabs.map((t) => (
        <Link
          key={t.id}
          href={t.href}
          className={"tab" + (current === t.id ? " active" : "")}
        >
          {t.label}
          {t.count != null && <span className="count">{t.count}</span>}
        </Link>
      ))}
    </div>
  );
}
