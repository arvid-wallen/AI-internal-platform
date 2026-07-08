import Link from "next/link";

export default function DashboardNotFound() {
  return (
    <div className="page">
      <div className="card" style={{ maxWidth: 520, margin: "48px auto" }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>Sidan finns inte</h2>
        <p className="dim" style={{ margin: "0 0 16px", fontSize: 13.5 }}>
          Innehållet du letar efter har flyttats eller finns inte längre.
        </p>
        <Link className="b primary" href="/dashboard">
          Till Operations →
        </Link>
      </div>
    </div>
  );
}
