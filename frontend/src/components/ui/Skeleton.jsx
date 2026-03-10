import React from 'react'

export const Skeleton = ({ className = '', ...props }) => {
  return (
    <div
      className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded ${className}`}
      {...props}
    />
  )
}

export const CardSkeleton = () => {
  return (
    <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 shadow-sm rounded-xl p-6 h-full flex flex-col relative overflow-hidden">
      <div className="flex justify-between items-start mb-4">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-5/6" />
      </div>
      <div className="mt-8">
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
    </div>
  )
}

export const TableSkeleton = ({ rows = 5, cols = 4 }) => {
  return (
    <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 shadow-sm rounded-xl overflow-hidden mt-6">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
        <Skeleton className="h-6 w-1/4" />
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>
      <div className="overflow-x-auto w-full">
        <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50/50 dark:bg-gray-800/50 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
            <tr>
              {Array.from({ length: cols }).map((_, idx) => (
                <th key={idx} scope="col" className="px-6 py-4">
                  <Skeleton className="h-4 w-20" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, rowIdx) => (
              <tr
                key={rowIdx}
                className="bg-transparent border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50/50 dark:hover:bg-gray-700/50"
              >
                {Array.from({ length: cols }).map((_, colIdx) => (
                  <td key={colIdx} className="px-6 py-4">
                    <Skeleton className="h-4 w-full" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export const StatCardSkeleton = () => {
  return (
    <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 shadow-sm rounded-xl p-6">
      <div className="flex items-center justify-between mb-2">
        <Skeleton className="h-4 w-24" />
        <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
          <Skeleton className="h-5 w-5" />
        </div>
      </div>
      <div className="flex items-baseline space-x-2">
        <Skeleton className="h-8 w-1/3" />
      </div>
      <div className="mt-2">
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  )
}
