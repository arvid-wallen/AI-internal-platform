import { Sidebar, Topbar } from "@/components/layout";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="app">
      <Sidebar />
      <Topbar />
      <div className="main">{children}</div>
    </div>
  );
}
