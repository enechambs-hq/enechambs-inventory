'use client';

import { useEffect, useRef, useState } from 'react';

interface NumericInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> {
  value: number | string | undefined;
  onChange: (rawValue: string) => void;
  /** Allow decimal point. Default true. */
  decimals?: boolean;
}

function toFormatted(raw: string, decimals: boolean): string {
  const n = parseFloat(raw.replace(/,/g, ''));
  if (isNaN(n) || n === 0) return '';
  const str = decimals
    ? n.toString()
    : Math.floor(n).toString();
  const [intPart, decPart] = str.split('.');
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decPart ? `${formattedInt}.${decPart}` : formattedInt;
}

function toRaw(value: number | string | undefined): string {
  if (value === undefined || value === null || value === '') return '';
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(/,/g, ''));
  if (isNaN(n) || n === 0) return '';
  return n.toString();
}

/**
 * Number input that:
 * - Shows raw digits while the user is typing
 * - Shows comma-formatted value on blur (e.g. 65,000)
 * - Shows placeholder when empty/zero
 * - Blocks non-numeric keys; no spinner arrows
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
  const [display, setDisplay] = useState(() => toFormatted(toRaw(value), decimals));
  const focusedRef = useRef(false);

  // Sync when value changes externally (form reset / defaultValues applied)
  useEffect(() => {
    if (!focusedRef.current) {
      setDisplay(toFormatted(toRaw(value), decimals));
    }
  }, [value, decimals]);

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    focusedRef.current = true;
    // Strip commas so the user sees the raw number
    setDisplay(toRaw(value));
    onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    focusedRef.current = false;
    setDisplay(toFormatted(display.replace(/,/g, ''), decimals));
    onBlur?.(e);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const nav = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End'];
    if (nav.includes(e.key)) return;
    if (decimals && e.key === '.' && !display.includes('.')) return;
    if (!/^\d$/.test(e.key)) e.preventDefault();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/,/g, '');
    setDisplay(raw);
    onChange(raw);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const text = e.clipboardData
      .getData('text')
      .replace(decimals ? /[^\d.]/g : /\D/g, '');
    setDisplay(text);
    onChange(text);
  };

  return (
    <input
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
