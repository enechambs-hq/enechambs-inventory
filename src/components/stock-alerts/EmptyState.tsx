import { CheckCircle2, Bell } from 'lucide-react';

export default function EmptyState() {
  return (
    <div className="bg-white border border-[#d0e9da] rounded-2xl px-8 py-16 flex flex-col items-center text-center shadow-sm">
      <div className="relative w-20 h-20 rounded-full bg-[#f3f9f5] border border-[#d0e9da] flex items-center justify-center mb-5">
        <div className="absolute inset-2 rounded-full bg-[#1a7a4a] flex items-center justify-center shadow-md">
          <CheckCircle2 size={28} className="text-white" strokeWidth={2.4} />
        </div>
      </div>

      <h3 className="text-lg font-semibold text-gray-900 tracking-tight">
        All products are well stocked
      </h3>
      <p className="mt-2 text-sm text-gray-500 max-w-sm leading-relaxed">
        Nothing to restock right now. We&rsquo;ll alert you here as soon as any product drops below
        its minimum threshold.
      </p>

      <div className="mt-7 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#f3f9f5] border border-[#d0e9da] text-sm text-[#155f3a]">
        <Bell size={14} />
        <span>Last checked just now</span>
      </div>
    </div>
  );
}
