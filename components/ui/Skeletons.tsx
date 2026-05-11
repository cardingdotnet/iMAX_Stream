/**
 * Skeleton loading components with shimmer effect
 */

export function PlaylistCardSkeleton() {
  return (
    <div className="card animate-pulse">
      <div className="aspect-square bg-white/[0.05] rounded-md mb-3 shimmer-bg" />
      <div className="h-4 bg-white/[0.05] rounded w-3/4 mb-2 shimmer-bg" />
      <div className="h-3 bg-white/[0.05] rounded w-1/2 shimmer-bg" />
    </div>
  );
}

export function TrackRowSkeleton() {
  return (
    <div className="flex items-center gap-3 sm:gap-4 px-2 sm:px-4 py-2">
      <div className="w-8 hidden sm:block" />
      <div className="w-12 h-12 sm:w-10 sm:h-10 bg-white/[0.05] rounded shimmer-bg flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="h-4 bg-white/[0.05] rounded w-3/4 mb-2 shimmer-bg" />
        <div className="h-3 bg-white/[0.05] rounded w-1/2 shimmer-bg" />
      </div>
      <div className="w-12 h-3 bg-white/[0.05] rounded shimmer-bg hidden sm:block" />
    </div>
  );
}

export function PlaylistGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <PlaylistCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function TrackListSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: count }).map((_, i) => (
        <TrackRowSkeleton key={i} />
      ))}
    </div>
  );
}
