import React from "react";

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-[#E5E3DC]/60 rounded ${className}`}
      aria-hidden="true"
    />
  );
}

export function MetricTilesSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-white border border-[#E5E3DC] rounded-lg p-4 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <div className="flex items-center gap-4 p-4 border-b border-[#E5E3DC] bg-white">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-6 w-16 ml-auto rounded-full" />
    </div>
  );
}

export function PrescriptionReviewSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[600px]">
      <div className="lg:col-span-5 bg-white border border-[#E5E3DC] rounded-lg p-4 flex flex-col gap-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="flex-1 w-full min-h-[480px] rounded" />
      </div>
      <div className="lg:col-span-7 bg-white border border-[#E5E3DC] rounded-lg p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-24 w-full rounded-md" />
        <Skeleton className="h-24 w-full rounded-md" />
        <Skeleton className="h-24 w-full rounded-md" />
      </div>
    </div>
  );
}

export function PatientSummarySkeleton() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white border border-[#E5E3DC] rounded-lg p-6 space-y-3">
        <Skeleton className="h-7 w-60" />
        <Skeleton className="h-4 w-40" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>

      <div className="bg-white border border-[#E5E3DC] rounded-lg p-6 space-y-4">
        <Skeleton className="h-6 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    </div>
  );
}
