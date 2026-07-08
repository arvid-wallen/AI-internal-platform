// Route-group loading skeleton — every dashboard page is force-dynamic with
// serial Supabase reads, so this shows on cold navigations.
export default function DashboardLoading() {
  return (
    <div className="page" aria-busy="true" aria-label="Läser in">
      <div className="page-head">
        <div className="left" style={{ width: "100%" }}>
          <div className="skeleton" style={{ width: 120, height: 12 }} />
          <div
            className="skeleton"
            style={{ width: 280, height: 28, marginTop: 8 }}
          />
        </div>
      </div>
      <div className="stack" style={{ gap: 16 }}>
        {[0, 1, 2].map((i) => (
          <div className="card" key={i}>
            <div className="skeleton" style={{ width: "40%", height: 16 }} />
            <div
              className="skeleton"
              style={{ width: "100%", height: 96, marginTop: 12 }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
