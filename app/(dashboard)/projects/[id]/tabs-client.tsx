"use client";

import { usePathname } from "next/navigation";
import { TabNav, type Tab } from "@/components/TabNav";

export function TabsClient({ tabs }: { tabs: Tab[] }) {
  const pathname = usePathname() ?? "";
  // figure current tab from URL: /projects/{id}/{tab?}
  const parts = pathname.split("/").filter(Boolean);
  const tabSeg = parts[2] || "overview";
  return <TabNav tabs={tabs} current={tabSeg} />;
}
