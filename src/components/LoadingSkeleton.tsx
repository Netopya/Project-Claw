interface LoadingSkeletonProps {
  className?: string;
}

export function LoadingSkeleton({ className = '' }: LoadingSkeletonProps) {
  return (
    <div className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded ${className}`} />
  );
}

export function AnimeCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="flex items-stretch">
        {/* Image skeleton */}
        <div className="flex-shrink-0 w-24 sm:w-32 h-32 sm:h-40">
          <LoadingSkeleton className="w-full h-full" />
        </div>

        {/* Content skeleton */}
        <div className="flex-1 p-4 space-y-3">
          {/* Title */}
          <LoadingSkeleton className="h-6 w-3/4" />
          
          {/* Japanese title */}
          <LoadingSkeleton className="h-4 w-1/2" />
          
          {/* Rating and episodes */}
          <div className="flex items-center space-x-4">
            <LoadingSkeleton className="h-4 w-16" />
            <LoadingSkeleton className="h-4 w-20" />
          </div>
          
          {/* Premiere date */}
          <LoadingSkeleton className="h-4 w-24" />
          
          {/* Link */}
          <LoadingSkeleton className="h-4 w-32" />
        </div>

        {/* Drag handle skeleton */}
        <div className="flex-shrink-0 w-12 bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
          <LoadingSkeleton className="w-5 h-5 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function AddAnimeFormSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center mb-4">
        <LoadingSkeleton className="w-10 h-10 rounded-lg" />
        <div className="ml-4 space-y-2 flex-1">
          <LoadingSkeleton className="h-5 w-48" />
          <LoadingSkeleton className="h-4 w-64" />
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <LoadingSkeleton className="h-4 w-32 mb-2" />
          <LoadingSkeleton className="h-12 w-full rounded-lg" />
        </div>
        
        <div className="flex gap-3">
          <LoadingSkeleton className="h-10 w-24 rounded-lg" />
          <LoadingSkeleton className="h-10 flex-1 rounded-lg" />
        </div>
      </div>

      <LoadingSkeleton className="h-16 w-full rounded-lg mt-4" />
    </div>
  );
}

interface WatchlistSkeletonProps {
  count?: number;
}

export function WatchlistSkeleton({ count = 3 }: WatchlistSkeletonProps) {
  return (
    <div className="space-y-6">
      <AddAnimeFormSkeleton />
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <LoadingSkeleton className="h-6 w-32" />
              <LoadingSkeleton className="h-4 w-48" />
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {Array.from({ length: count }).map((_, i) => (
            <AnimeCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}