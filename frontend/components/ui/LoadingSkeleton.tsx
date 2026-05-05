export function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-4 w-3/4 animate-pulse rounded-full bg-slate-700" />
      <div className="h-24 animate-pulse rounded-3xl bg-slate-800" />
    </div>
  );
}

export default LoadingSkeleton;
