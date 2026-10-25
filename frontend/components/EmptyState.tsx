import React from "react";
import { LucideIcon, Inbox } from "lucide-react";
import Link from "next/link";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
  className?: string;
}

export default function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  actionHref,
  actionLabel,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-8 bg-white border border-[#E5E3DC] rounded-lg ${className}`}
    >
      <div className="w-12 h-12 rounded-full bg-[#F1EFEA] border border-[#E5E3DC] flex items-center justify-center text-[#747D78] mb-3">
        <Icon size={22} strokeWidth={1.75} />
      </div>

      <h3 className="font-semibold text-sm text-[#202722] tracking-tight">{title}</h3>
      <p className="text-xs text-[#747D78] max-w-sm mt-1 leading-relaxed">{description}</p>

      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#315C4C] text-white text-xs font-medium rounded-md hover:bg-[#25463A] transition-colors shadow-xs"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
