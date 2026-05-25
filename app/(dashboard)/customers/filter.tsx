"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icons } from "@/components/icons";
import { ClassPill, StatusPill } from "@/components/ui";
import { fmt } from "@/lib/format";

export interface CustomerRow {
  id: string;
  name: string;
  org_number: string;
  cls: "A" | "B" | "C";
  am: string;
  contract: string;
  mrr: number;
  mark: string;
  init: string;
  project_count: number;
  live_count: number;
}

export function CustomersFilter({ customers }: { customers: CustomerRow[] }) {
  const [q, setQ] = useState("");
  const [cls, setCls] = useState<"all" | "A" | "B" | "C">("all");

  const items = useMemo(
    () =>
      customers.filter((c) => {
        if (cls !== "all" && c.cls !== cls) return false;
        if (q && !c.name.toLowerCase().includes(q.toLowerCase()))
          return false;
        return true;
      }),
    [customers, cls, q],
  );

  return (
    <div className="card flush">
      <div className="filterbar">
        <div className="fb-search">
          <Icons.Search size={14} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Sök kund eller org.nr"
            aria-label="Sök kund eller org.nr"
          />
        </div>
        <button
          className={"chip" + (cls === "all" ? " active" : "")}
          onClick={() => setCls("all")}
          type="button"
        >
          Alla <span className="count">{customers.length}</span>
        </button>
        {(["A", "B", "C"] as const).map((k) => (
          <button
            key={k}
            className={"chip" + (cls === k ? " active" : "")}
            onClick={() => setCls(k)}
            type="button"
          >
            Class {k}
          </button>
        ))}
        <div className="flex-1"></div>
        <button className="b sm" type="button" disabled title="Kommer snart">
          <Icons.Filter size={12} />
          Fler filter
        </button>
      </div>
      <table className="tbl">
        <thead>
          <tr>
            <th style={{ width: 40 }}></th>
            <th>Kund</th>
            <th>Account manager</th>
            <th>Klass</th>
            <th>Status</th>
            <th>Projekt</th>
            <th className="num">MRR</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <tr key={c.id}>
              <td>
                <Link href={`/customers/${c.id}`} style={{ display: "block" }}>
                  <div
                    className={"detail-mark dm-" + c.mark}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      fontSize: 14,
                    }}
                  >
                    {c.init}
                  </div>
                </Link>
              </td>
              <td>
                <Link
                  href={`/customers/${c.id}`}
                  style={{ display: "block", textDecoration: "none" }}
                >
                  <div className="strong">{c.name}</div>
                  <div className="sub tnum">{c.org_number}</div>
                </Link>
              </td>
              <td>{c.am}</td>
              <td>
                <ClassPill cls={c.cls} />
              </td>
              <td>
                <StatusPill status={c.contract} />
              </td>
              <td>
                <div className="row" style={{ gap: 6 }}>
                  <span className="tnum">{c.project_count}</span>
                  <span className="dim" style={{ fontSize: 11 }}>
                    ({c.live_count} live)
                  </span>
                </div>
              </td>
              <td className="num">{fmt.ksek(c.mrr)}</td>
              <td>
                <span className="dim">
                  <Icons.ChevR size={14} />
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
