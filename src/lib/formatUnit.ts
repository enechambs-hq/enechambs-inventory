const IRREGULAR: Record<string, string> = {
  dozen: 'dozen',
};

export function formatUnit(quantity: number, unit: string): string {
  const plural = IRREGULAR[unit] ?? `${unit}s`;
  return `${quantity} ${quantity === 1 ? unit : plural}`;
}
