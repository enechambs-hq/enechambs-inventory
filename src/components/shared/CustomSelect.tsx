'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface Option {
  value: string | number;
  label: string;
}

interface Props {
  options: Option[];
  value: string | number;
  onChange: (value: string | number) => void;
  placeholder?: string;
  hasError?: boolean;
}

export default function CustomSelect({ options, value, onChange, placeholder = 'Select…', hasError }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = options.find((o) => String(o.value) === String(value));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-md border bg-background text-sm transition-all
          ${open ? 'border-[#1a7a4a] ring-2 ring-[#1a7a4a]/20' : hasError ? 'border-destructive' : 'border-input'}
          focus:outline-none`}
      >
        <span className={selected ? 'text-foreground' : 'text-muted-foreground'}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-[#1a7a4a] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-[#d0e9da] rounded-lg shadow-lg overflow-hidden max-h-52 overflow-y-auto">
          {options.map((opt) => {
            const isSelected = String(opt.value) === String(value);
            return (
              <li
                key={opt.value}
                onMouseDown={() => { onChange(opt.value); setOpen(false); }}
                className={`flex items-center justify-between px-3 py-2 text-sm cursor-pointer transition-colors
                  ${isSelected
                    ? 'bg-[#e8f5ee] text-[#1a7a4a] font-medium'
                    : 'text-foreground hover:bg-[#f3f9f5] hover:text-[#1a7a4a]'
                  }`}
              >
                <span>{opt.label}</span>
                {isSelected && <Check size={13} className="text-[#1a7a4a]" strokeWidth={2.5} />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
