export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2.5">
          <div className="h-8 w-52 rounded-2xl bg-secondary animate-pulse" />
          <div className="h-4 w-72 rounded-xl bg-secondary/60 animate-pulse" />
        </div>
        <div className="h-10 w-28 rounded-xl bg-secondary animate-pulse" />
      </div>

      {/* Metric cards row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-card border border-border/50 rounded-2xl p-5 space-y-3">
            <div className="h-3 w-20 rounded bg-secondary animate-pulse" />
            <div className="h-7 w-28 rounded-lg bg-secondary animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
            <div className="h-2.5 w-16 rounded bg-secondary/60 animate-pulse" />
          </div>
        ))}
      </div>

      {/* Large card (chart / summary) */}
      <div className="bg-card border border-border/50 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="h-5 w-36 rounded-lg bg-secondary animate-pulse" />
          <div className="h-4 w-20 rounded bg-secondary/60 animate-pulse" />
        </div>
        <div className="h-52 rounded-xl bg-secondary/50 animate-pulse" />
      </div>

      {/* List rows */}
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="bg-card border border-border/50 rounded-2xl px-5 py-4 flex items-center gap-4"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="w-10 h-10 rounded-xl bg-secondary animate-pulse flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-36 rounded bg-secondary animate-pulse" />
              <div className="h-2.5 w-24 rounded bg-secondary/60 animate-pulse" />
            </div>
            <div className="h-5 w-20 rounded-lg bg-secondary animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
