
type SkeletonProps = {
  className?: string;
};

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-slate-200 dark:bg-slate-800 rounded-md ${className}`}
    />
  );
}

export function BookCardSkeleton() {
  return (
    <div className="w-[280px] h-[340px] border border-border rounded-2xl p-4 flex flex-col justify-between bg-surface shadow-xs">
      <Skeleton className="h-40 w-full rounded-xl" />
      <div className="space-y-2 py-3 flex-1">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <div className="flex items-center gap-3 pt-3 border-t border-border/40 shrink-0">
        <Skeleton className="w-8 h-8 rounded-full" />
        <div className="flex-1 space-y-1">
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    </div>
  );
}

export default Skeleton;
