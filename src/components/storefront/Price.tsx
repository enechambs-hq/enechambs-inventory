import { formatNaira } from '@/lib/storefront/catalogue';

export default function Price({
  price,
  referencePrice,
  size = 'md',
}: {
  price: number;
  referencePrice: number | null;
  size?: 'md' | 'lg';
}) {
  const showReference = referencePrice !== null && referencePrice > price;
  return (
    <p className="flex flex-wrap items-baseline gap-x-2">
      <span className={`font-bold text-[#0f4f2d] ${size === 'lg' ? 'text-3xl' : 'text-lg'}`}>{formatNaira(price)}</span>
      {showReference && (
        <>
          <span className="sr-only">was</span>
          <s className={`text-[#8b7f6b] ${size === 'lg' ? 'text-lg' : 'text-sm'}`}>{formatNaira(referencePrice)}</s>
        </>
      )}
    </p>
  );
}
