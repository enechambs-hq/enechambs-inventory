import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format a number with commas, e.g. 950000 → "950,000" */
export function formatAmount(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

/** Fix BE-generated activity descriptions: $ → ₦, format amounts, null IMEI → N/A */
export function formatActivityDescription(desc: string): string {
  return desc
    .replace(/IMEI: null/gi, 'IMEI: N/A')
    .replace(/\$\s*([\d,]+(?:\.\d+)?)/g, (_, n) => `₦${formatAmount(Number(n.replace(/,/g, '')))}`)
    .replace(/Amount:\s*([\d,]+(?:\.\d+)?)/g, (_, n) => `Amount: ₦${formatAmount(Number(n.replace(/,/g, '')))}`);
}
