import type { PublicCombo } from '@/types/storefront';
import { formatNaira } from '@/lib/storefront/catalogue';
import BrandMark from './BrandMark';
import SafeImage, { ImagePlaceholder } from './SafeImage';

/**
 * The 3D-inspired campaign visual, built from CSS depth only: a perspective
 * scene, a preserve-3d stage and layers at different translateZ depths (a
 * glowing platter, three tilted cards, a floating badge, sparkles). Nothing is
 * invented: cards show REAL published combos (image, name, price) when the API
 * has them, and a branded placeholder otherwise.
 *
 * Decorative (aria-hidden): the same combos are listed accessibly below the
 * hero. Motion is a slow float and a hover tilt; both stop under
 * prefers-reduced-motion (see globals.css).
 */

interface CardSpec {
  position: string;
  depth: number;
  tilt: number;
}

const CARDS: CardSpec[] = [
  { position: 'left-[2%] top-[24%] w-[34%]', depth: 50, tilt: -7 },
  { position: 'left-[31%] top-[5%] w-[38%]', depth: 120, tilt: 0 },
  { position: 'right-[2%] top-[21%] w-[34%]', depth: 75, tilt: 7 },
];

function Card({ spec, combo, index }: { spec: CardSpec; combo?: PublicCombo; index: number }) {
  const image = combo?.images[0];
  return (
    <div
      className={`ene-layer absolute ${spec.position}`}
      style={{ transform: `translateZ(${spec.depth}px) rotateZ(${spec.tilt}deg)` }}
    >
      <div
        className={`${index === 1 ? 'ene-float' : 'ene-float-slow'} relative aspect-[4/5] overflow-hidden rounded-[1.4rem] border border-white/40 bg-[#0f4f2d] shadow-[0_30px_45px_-18px_rgba(0,0,0,0.65),0_0_0_1px_rgba(255,255,255,0.08)_inset]`}
      >
        {image ? (
          <SafeImage src={image.url} alt="" priority className="h-full w-full" />
        ) : (
          <ImagePlaceholder className="h-full w-full" />
        )}
        {/* soft top sheen for a glossy, dimensional surface */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/25 via-transparent to-black/10" />
        {combo && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 pb-3 pt-10">
            <p className="line-clamp-2 text-[0.7rem] font-semibold leading-tight text-white sm:text-xs">{combo.name}</p>
            <p className="mt-0.5 text-[0.7rem] font-bold text-[#f4b942] sm:text-xs">{formatNaira(combo.price)}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function HeroVisual({ combos }: { combos: PublicCombo[] }) {
  // Prefer combos that have a real photo; fill the rest with placeholders.
  const withImages = combos.filter((c) => c.images.length > 0);
  const chosen = [...withImages, ...combos.filter((c) => c.images.length === 0)].slice(0, 3);
  // The tallest card sits in the middle: put the first real combo there.
  const slots: Array<PublicCombo | undefined> = [chosen[1], chosen[0], chosen[2]];

  return (
    <div className="ene-scene relative mx-auto aspect-[5/4] w-full max-w-[36rem]" aria-hidden="true">
      {/* warm glow behind everything */}
      <div className="absolute inset-[-8%] rounded-full bg-[radial-gradient(closest-side,rgba(244,185,66,0.55),rgba(244,185,66,0)_70%)] blur-2xl" />

      <div className="ene-stage absolute inset-0">
        {/* the platter the composition stands on */}
        <div
          className="ene-layer absolute inset-x-[4%] bottom-[2%] h-[38%]"
          style={{ transform: 'translateZ(0px)' }}
        >
          <div className="h-full w-full rounded-[50%] bg-[radial-gradient(ellipse_at_50%_35%,#ffd979,#f4b942_45%,#c98914)] shadow-[0_40px_60px_-18px_rgba(0,0,0,0.6)]" />
          <div className="absolute inset-[9%] rounded-[50%] border-2 border-white/35" />
          <div className="absolute inset-[22%] rounded-[50%] border border-white/25" />
          <BrandMark size={34} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-70" />
        </div>

        {CARDS.map((spec, i) => (
          <Card key={spec.position} spec={spec} combo={slots[i]} index={i} />
        ))}

        {/* floating campaign badge, closest to the viewer */}
        <div
          className="ene-layer absolute right-[1%] top-[3%] w-[24%]"
          style={{ transform: 'translateZ(180px) rotateZ(8deg)' }}
        >
          <div className="ene-float aspect-square rounded-full bg-[radial-gradient(circle_at_30%_25%,#ffe9a8,#f4b942_55%,#d79a1f)] p-[7%] shadow-[0_22px_30px_-10px_rgba(0,0,0,0.55)] ring-4 ring-white/50">
            <div className="flex h-full w-full flex-col items-center justify-center rounded-full border-2 border-dashed border-[#0b3d22]/40 text-center text-[#0b3d22]">
              <span className="text-[0.55rem] font-bold uppercase tracking-widest sm:text-[0.65rem]">Year-End</span>
              <span className="text-[0.85rem] font-extrabold leading-none sm:text-xl">Combos</span>
            </div>
          </div>
        </div>

        {/* sparkles */}
        {[
          'left-[6%] top-[10%] h-3 w-3',
          'left-[46%] top-[1%] h-2 w-2',
          'right-[10%] bottom-[30%] h-2.5 w-2.5',
          'left-[16%] bottom-[22%] h-2 w-2',
        ].map((cls, i) => (
          <span
            key={cls}
            className={`ene-layer ene-float${i % 2 ? '-slow' : ''} absolute rotate-45 rounded-[2px] bg-[#ffe9a8] shadow-[0_0_12px_3px_rgba(255,233,168,0.7)] ${cls}`}
            style={{ transform: `translateZ(${140 + i * 15}px) rotate(45deg)` }}
          />
        ))}
      </div>
    </div>
  );
}
