import { Icons } from "@/components/icons";

export default function WorkflowsPage() {
  return (
    <div className="page">
      <div className="page-head">
        <div className="left">
          <div className="page-eyebrow">Workflows</div>
          <h1 className="page-title">Workflows &amp; Tools</h1>
          <p className="page-sub">
            Interna verktyg och automationer. Kommer i v1.1.
          </p>
        </div>
      </div>
      <div className="card empty" style={{ padding: 64 }}>
        <Icons.Workflow size={40} />
        <div className="mt-3" style={{ fontSize: 14 }}>
          Inget konfigurerat ännu.
        </div>
      </div>
    </div>
  );
}
