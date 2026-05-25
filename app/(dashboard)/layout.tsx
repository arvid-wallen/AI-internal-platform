import { Sidebar, Topbar } from "@/components/layout";
import { listCustomers, listProjects } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [customers, projects] = await Promise.all([
    listCustomers(),
    listProjects(),
  ]);

  return (
    <div className="app">
      <Sidebar customerCount={customers.length} projectCount={projects.length} />
      <Topbar
        customers={customers.map((c) => ({ id: c.id, name: c.name }))}
        projects={projects.map((p) => ({
          id: p.id,
          slug: p.slug,
          name: p.name,
        }))}
      />
      <div className="main">{children}</div>
    </div>
  );
}
