function Bone({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`rounded-xl bg-secondary animate-pulse ${className ?? ""}`}
      style={style}
    />
  );
}

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Bone className="h-8 w-48" />
          <Bone className="h-4 w-64 opacity-60" />
        </div>
        <Bone className="h-10 w-28" />
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[0, 60, 120, 180].map((delay) => (
          <div key={delay} className="bg-card border border-border/50 rounded-2xl p-5 space-y-3">
            <Bone className="h-3 w-16" style={{ animationDelay: `${delay}ms` }} />
            <Bone className="h-7 w-24" style={{ animationDelay: `${delay}ms` }} />
            <Bone className="h-2.5 w-14 opacity-50" style={{ animationDelay: `${delay}ms` }} />
          </div>
        ))}
      </div>

      {/* Big card */}
      <div className="bg-card border border-border/50 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <Bone className="h-5 w-32" />
          <Bone className="h-4 w-16 opacity-50" />
        </div>
        <Bone className="h-48 w-full" style={{ borderRadius: "12px" }} />
      </div>

      {/* List rows */}
      <div className="space-y-3">
        {[0, 80, 160, 240].map((delay) => (
          <div key={delay} className="bg-card border border-border/50 rounded-2xl px-5 py-4 flex items-center gap-4">
            <Bone className="w-10 h-10 flex-shrink-0" style={{ animationDelay: `${delay}ms` }} />
            <div className="flex-1 space-y-2">
              <Bone className="h-3.5 w-36" style={{ animationDelay: `${delay}ms` }} />
              <Bone className="h-2.5 w-24 opacity-50" style={{ animationDelay: `${delay}ms` }} />
            </div>
            <Bone className="h-5 w-20" style={{ animationDelay: `${delay}ms` }} />
          </div>
        ))}
      </div>
    </div>
  );
}
