export const ClusterMapSkeleton = () => (
  <div className="rounded-2xl border border-cluster-border bg-cluster-surface p-4 shadow-xs sm:p-5">
    <div className="animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="h-5 w-24 rounded-md bg-cluster-surface-soft" />

        <div className="flex items-center gap-4 rounded-xl bg-cluster-surface-soft px-4 py-2 sm:gap-6">
          <div className="h-10 w-12 rounded-md bg-secondary/60" />
          <div className="h-10 w-12 rounded-md bg-secondary/60" />
          <div className="h-10 w-12 rounded-md bg-secondary/60" />
        </div>
      </div>

      {/* Map */}
      <div className="mt-8 space-y-5">
        <div className="flex items-center gap-4">
          <div className="h-4 w-8 rounded bg-secondary/60" />
          <div className="h-16 w-3/4 rounded-xl bg-cluster-surface-soft" />
        </div>

        <div className="flex items-center gap-4">
          <div className="h-4 w-8 rounded bg-secondary/60" />
          <div className="h-16 w-2/3 rounded-xl bg-cluster-surface-soft" />
        </div>

        <div className="flex items-center gap-4">
          <div className="h-4 w-8 rounded bg-secondary/60" />
          <div className="h-16 w-4/5 rounded-xl bg-cluster-surface-soft" />
        </div>

        <div className="flex items-center gap-4">
          <div className="h-4 w-8 rounded bg-secondary/60" />
          <div className="h-16 w-1/2 rounded-xl bg-cluster-surface-soft" />
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 flex items-center justify-between border-t border-cluster-border pt-3">
        <div className="h-4 w-32 rounded bg-secondary/60" />
        <div className="h-3 w-28 rounded bg-secondary/60" />
      </div>
    </div>
  </div>
);
