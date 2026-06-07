'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

interface NumericInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> {
  value: number | string | undefined;
  onChange: (rawValue: string) => void;
  /** Allow decimal point. Default true. */
  decimals?: boolean;
}

function formatNum(raw: string, decimals: boolean): string {
  if (!raw || raw === '.') return raw;
  const [intPart = '', decPart] = raw.split('.');
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (!decimals || decPart === undefined) return formattedInt;
  return `${formattedInt}.${decPart}`;
}

function toRaw(value: number | string | undefined): string {
  if (value === undefined || value === null || value === '') return '';
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(/,/g, ''));
  if (isNaN(n) || n === 0) return '';
  return n.toString();
}

// Find the cursor index in `formatted` after `digitTarget` digits have been counted.
function cursorForDigits(formatted: string, digitTarget: number): number {
  let digitCount = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (formatted[i] !== ',') digitCount++;
    if (digitCount === digitTarget) return i + 1;
  }
  return formatted.length;
}

/**
 * Number input that:
 * - Shows comma-formatted value in real time as the user types (e.g. 1,000,000)
 * - Backspace skips commas — deletes the digit before the comma automatically
 * - Blocks non-numeric keys; no spinner arrows
 * - Calls onChange with the raw unformatted string
 */
export function NumericInput({
  value,
  onChange,
  decimals = true,
  placeholder = '0',
  className,
  onBlur,
  onFocus,
  ...rest
}: NumericInputProps) {
  const [display, setDisplay] = useState(() => formatNum(toRaw(value), decimals));
  const focusedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingCursor = useRef<number | null>(null);

  // Sync when value changes externally (form reset / defaultValues applied)
  useEffect(() => {
    if (!focusedRef.current) {
      setDisplay(formatNum(toRaw(value), decimals));
    }
  }, [value, decimals]);

  // Apply pending cursor position after React re-renders the controlled input
  useLayoutEffect(() => {
    if (pendingCursor.current !== null && inputRef.current) {
      inputRef.current.setSelectionRange(pendingCursor.current, pendingCursor.current);
      pendingCursor.current = null;
    }
  });

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    focusedRef.current = true;
    onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    focusedRef.current = false;
    const r = display.replace(/,/g, '');
    const n = parseFloat(r);
    setDisplay(isNaN(n) || n === 0 ? '' : formatNum(r, decimals));
    onBlur?.(e);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const nav = ['Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End'];
    if (nav.includes(e.key)) return;

    if (e.key === 'Backspace') {
      const input = inputRef.current!;
      const pos = input.selectionStart ?? 0;
      const selEnd = input.selectionEnd ?? pos;
      // If there's a selection, let the browser remove it; handleChange reformats.
      if (pos !== selEnd) return;
      if (pos === 0) return;

      e.preventDefault();
      // If cursor is right after a comma, also delete the digit before the comma.
      const skip = display[pos - 1] === ',' ? 2 : 1;
      const newRaw = (display.slice(0, pos - skip) + display.slice(pos)).replace(/,/g, '');
      const newFormatted = formatNum(newRaw, decimals);
      const digitTarget = display.slice(0, pos - skip).replace(/,/g, '').length;

      setDisplay(newFormatted);
      onChange(newRaw);
      pendingCursor.current = cursorForDigits(newFormatted, digitTarget);
      return;
    }

    if (decimals && e.key === '.' && !display.includes('.')) return;
    if (!/^\d$/.test(e.key)) e.preventDefault();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const selStart = input.selectionStart ?? input.value.length;

    // Compute cursor position in terms of digits (ignoring commas)
    const commasBefore = (input.value.slice(0, selStart).match(/,/g) ?? []).length;
    const digitTarget = selStart - commasBefore;

    const raw = input.value.replace(decimals ? /[^0-9.]/g : /[^0-9]/g, '');
    const formatted = formatNum(raw, decimals);

    setDisplay(formatted);
    onChange(raw);
    pendingCursor.current = cursorForDigits(formatted, digitTarget);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const text = e.clipboardData
      .getData('text')
      .replace(decimals ? /[^\d.]/g : /\D/g, '');
    const formatted = formatNum(text, decimals);
    setDisplay(formatted);
    onChange(text);
    pendingCursor.current = formatted.length;
  };

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode={decimals ? 'decimal' : 'numeric'}
      value={display}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={className}
      {...rest}
    />
  );
}
