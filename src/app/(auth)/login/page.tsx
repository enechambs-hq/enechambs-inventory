"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { authService } from "@/lib/services/auth.service";
import { toast } from "sonner";
import { UserRole } from "@/types";

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const C = {
  green:       '#1a7a4a',
  greenDeep:   '#0e5733',
  greenDarker: '#0a4a2b',
  text:        '#0f1a14',
  muted:       '#64716a',
  border:      '#e6ebe7',
  jollof:      '#c44e2a',
  palm:        '#b86b1f',
  saffron:     '#d99a1f',
  pepper:      '#a8281a',
} as const;

// ─── Deterministic RNG (no Math.random — prevents SSR hydration mismatch) ─────
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = ((s * 1664525) + 1013904223) & 0xFFFFFFFF;
    return (s >>> 0) / 4294967296;
  };
}

const GRAIN_DOTS = (() => {
  const r = makeRng(42);
  return Array.from({ length: 60 }, () => ({
    x: 40 + r() * 140, y: 70 + r() * 28,
    rx: 2 + r() * 1.5, rotate: r() * 60 - 30,
  }));
})();

const PEPPER_BITS = (() => {
  const r = makeRng(77);
  return Array.from({ length: 8 }, (_, i) => ({
    cx: 50 + i * 16 + r() * 8, cy: 75 + r() * 14,
  }));
})();

const SCATTER_GRAINS = (() => {
  const r = makeRng(13);
  return Array.from({ length: 40 }, () => ({
    x: r() * 120, y: r() * 120, rotate: r() * 360,
  }));
})();

// ─── Decorative SVG illustrations ─────────────────────────────────────────────

function GrainBowl({ size = 220 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.9} viewBox="0 0 220 200">
      <ellipse cx="110" cy="178" rx="78" ry="9" fill="rgba(0,0,0,0.35)" />
      <path d="M28 100 Q110 130 192 100 L180 160 Q110 195 40 160 Z" fill="#3a2418" />
      <path d="M28 100 Q110 130 192 100 L188 118 Q110 144 32 118 Z" fill="#5a3422" />
      <ellipse cx="110" cy="100" rx="82" ry="22" fill="#1f120a" />
      <ellipse cx="110" cy="98" rx="82" ry="20" fill="#2a1810" />
      <ellipse cx="110" cy="92" rx="78" ry="20" fill={C.jollof} />
      <ellipse cx="110" cy="86" rx="74" ry="18" fill="#d96138" />
      <ellipse cx="100" cy="78" rx="56" ry="14" fill="#e07c4a" />
      {GRAIN_DOTS.map((d, i) => (
        <ellipse key={i} cx={d.x} cy={d.y} rx={d.rx} ry={d.rx * 0.5}
          fill="#fff5e0" opacity={0.7}
          transform={`rotate(${d.rotate} ${d.x} ${d.y})`} />
      ))}
      {PEPPER_BITS.map((p, i) => (
        <circle key={i} cx={p.cx} cy={p.cy} r={2.5} fill="#8a1810" />
      ))}
      <path d="M70 60 Q66 50 72 42 Q78 34 72 24" stroke="rgba(255,255,255,0.4)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M110 50 Q106 40 112 32 Q118 24 112 14" stroke="rgba(255,255,255,0.5)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M148 60 Q144 50 150 42 Q156 34 150 24" stroke="rgba(255,255,255,0.4)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function Pepper({ size = 80, rotate = 0, color = C.pepper }: { size?: number; rotate?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" style={{ transform: `rotate(${rotate}deg)` }}>
      <path d="M40 14 L42 22 L38 22 Z" fill="#3a5a1a" />
      <ellipse cx="40" cy="22" rx="6" ry="3" fill="#3a5a1a" />
      <path d="M40 24 Q60 30 62 50 Q60 68 40 70 Q20 68 18 50 Q20 30 40 24 Z" fill={color} />
      <path d="M40 24 Q56 30 58 48 Q56 60 50 64 Q48 50 42 32 Z" fill="rgba(255,255,255,0.18)" />
      <path d="M30 56 Q34 58 38 56" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function PalmFruit({ size = 70 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80">
      {Array.from({ length: 14 }, (_, i) => {
        const angle = (i / 14) * Math.PI * 2;
        return (
          <circle key={i}
            cx={40 + Math.cos(angle) * 18}
            cy={40 + Math.sin(angle) * 18}
            r={9} fill={i % 3 === 0 ? '#e0701a' : C.palm} />
        );
      })}
      <circle cx="40" cy="40" r="12" fill="#7a3a10" />
      {Array.from({ length: 6 }, (_, i) => (
        <circle key={i} cx={36 + (i % 3) * 4} cy={36 + Math.floor(i / 3) * 5} r={2} fill="#e0701a" />
      ))}
      <path d="M40 22 L34 8 L46 8 Z" fill="#2a5a2a" />
    </svg>
  );
}

function Leaf({ size = 60, rotate = 0 }: { size?: number; rotate?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" style={{ transform: `rotate(${rotate}deg)` }}>
      <path d="M30 5 Q55 25 45 50 Q30 60 15 50 Q5 25 30 5 Z" fill="#1f5a2e" />
      <path d="M30 5 Q35 30 30 55" stroke="#0e3a18" strokeWidth="1.5" fill="none" />
      <path d="M30 18 Q40 22 44 30 M30 28 Q40 32 44 38 M30 38 Q40 42 42 46 M30 18 Q20 22 16 30 M30 28 Q20 32 16 38 M30 38 Q20 42 18 46"
        stroke="#0e3a18" strokeWidth="1" fill="none" opacity={0.6} />
    </svg>
  );
}

function GrainScatter() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120">
      {SCATTER_GRAINS.map((g, i) => (
        <ellipse key={i} cx={g.x} cy={g.y} rx={3} ry={1.5}
          fill="#f5d99a"
          transform={`rotate(${g.rotate} ${g.x} ${g.y})`} />
      ))}
    </svg>
  );
}

function StatChip({ icon, label, value, accent }: {
  icon: React.ReactNode; label: string; value: string; accent?: string;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 14px', borderRadius: 12,
      background: 'rgba(255,255,255,0.08)',
      border: '1px solid rgba(255,255,255,0.12)',
      backdropFilter: 'blur(8px)',
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        background: accent || 'rgba(255,255,255,0.15)',
        display: 'grid', placeItems: 'center', color: '#fff',
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 500, letterSpacing: 0.4, textTransform: 'uppercase' }}>
          {label}
        </div>
        <div style={{ fontSize: 16, color: '#fff', fontWeight: 700, fontVariantNumeric: 'tabular-nums', marginTop: 1 }}>
          {value}
        </div>
      </div>
    </div>
  );
}

// ─── Schema ───────────────────────────────────────────────────────────────────
const loginSchema = z.object({
  email:    z.email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});
type LoginForm = z.infer<typeof loginSchema>;

// ─── Logo mark (transparent bg, for use on dark panels) ───────────────────────
function LogoMark() {
  return (
    <div style={{
      width: 40, height: 40, borderRadius: 11, flexShrink: 0,
      background: 'rgba(255,255,255,0.14)',
      backdropFilter: 'blur(8px)',
      border: '1px solid rgba(255,255,255,0.2)',
      display: 'grid', placeItems: 'center',
    }}>
      <svg width="22" height="22" viewBox="0 0 40 40" fill="none">
        <rect x="9" y="7" width="3.5" height="27" rx="1.75" fill="white" />
        <path d="M9 7H22C25 7 27 8.6 27 10.5C27 12.4 25 14 22 14H9V7Z" fill="white" />
        <path d="M9 18H18C20.8 18 22.5 19.3 22.5 21C22.5 22.7 20.8 24 18 24H9V18Z" fill="white" />
        <path d="M9 27H22C25 27 27 28.6 27 30.5C27 32.4 25 34 22 34H9V27Z" fill="white" />
        <circle cx="27" cy="10.5" r="2.2" fill="#a3f0c0" fillOpacity={0.9} />
        <circle cx="22.5" cy="21" r="1.8" fill="#a3f0c0" fillOpacity={0.8} />
        <circle cx="27" cy="30.5" r="2.2" fill="#a3f0c0" fillOpacity={0.9} />
      </svg>
    </div>
  );
}

// ─── Full logo (with gradient bg, for mobile) ─────────────────────────────────
function LogoFull() {
  return (
    <svg width="48" height="48" viewBox="0 0 40 40" fill="none">
      <defs>
        <linearGradient id="mobileLogoBg" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#1a9155" />
          <stop offset="1" stopColor="#0b3d22" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="9" fill="url(#mobileLogoBg)" />
      <ellipse cx="20" cy="3.5" rx="13" ry="5" fill="white" fillOpacity={0.07} />
      <rect x="9" y="7" width="3.5" height="27" rx="1.75" fill="white" />
      <path d="M9 7H22C25 7 27 8.6 27 10.5C27 12.4 25 14 22 14H9V7Z" fill="white" />
      <path d="M9 18H18C20.8 18 22.5 19.3 22.5 21C22.5 22.7 20.8 24 18 24H9V18Z" fill="white" />
      <path d="M9 27H22C25 27 27 28.6 27 30.5C27 32.4 25 34 22 34H9V27Z" fill="white" />
      <circle cx="27" cy="10.5" r="2.2" fill="#a3f0c0" fillOpacity={0.9} />
      <circle cx="22.5" cy="21" r="1.8" fill="#a3f0c0" fillOpacity={0.8} />
      <circle cx="27" cy="30.5" r="2.2" fill="#a3f0c0" fillOpacity={0.9} />
    </svg>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const router = useRouter();
  const { setAuth, isAuthenticated, user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [pwFocused, setPwFocused] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user) {
      router.replace(user.role === UserRole.ADMIN ? "/dashboard" : "/inventory");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    try {
      setIsLoading(true);
      const response = await authService.login(data);
      setAuth(response.user, response.access_token);
      router.push(response.user.role === UserRole.ADMIN ? "/dashboard" : "/inventory");
    } catch (error) {
      const err = error as { response?: { data?: { message?: string | string[] } }; message?: string };
      const msg = err.response?.data?.message || err.message || "Something went wrong";
      toast.error(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: '"Inter", system-ui, sans-serif', color: C.text }}>

      {/* ═══════════════════════════════════════════════════════════
          LEFT PANEL — atmospheric green hero
          ═══════════════════════════════════════════════════════════ */}
      <div
        className="hidden lg:flex"
        style={{
          flex: '0 0 56%', position: 'relative', overflow: 'hidden',
          background: `radial-gradient(ellipse at 20% 10%, #1f8a55 0%, ${C.green} 35%, ${C.greenDeep} 75%, ${C.greenDarker} 100%)`,
          color: '#fff', padding: '36px 48px',
          flexDirection: 'column',
        }}
      >
        {/* Weave pattern overlay */}
        <svg style={{ position: 'absolute', inset: 0, opacity: 0.06, pointerEvents: 'none', width: '100%', height: '100%' }}>
          <defs>
            <pattern id="weave" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M0 20 Q20 0 40 20 Q20 40 0 20 Z" stroke="#fff" strokeWidth="0.8" fill="none" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#weave)" />
        </svg>

        {/* Decorative foodstuff elements */}
        <div style={{ position: 'absolute', top: 80, right: 60, opacity: 0.85, zIndex: 0, pointerEvents: 'none' }}>
          <Pepper size={70} rotate={-25} />
        </div>
        <div style={{ position: 'absolute', top: 220, right: 280, opacity: 0.4, zIndex: 0, pointerEvents: 'none' }}>
          <Pepper size={42} rotate={140} color={C.saffron} />
        </div>
        <div style={{ position: 'absolute', top: 360, left: 60, opacity: 0.6, zIndex: 0, pointerEvents: 'none' }}>
          <Leaf size={70} rotate={-15} />
        </div>
        <div style={{ position: 'absolute', bottom: 200, right: 80, opacity: 0.55, zIndex: 0, pointerEvents: 'none' }}>
          <Leaf size={90} rotate={25} />
        </div>
        <div style={{ position: 'absolute', bottom: 320, right: 220, opacity: 0.7, zIndex: 0, pointerEvents: 'none' }}>
          <PalmFruit size={64} />
        </div>
        <div style={{ position: 'absolute', top: 140, left: 380, opacity: 0.35, zIndex: 0, pointerEvents: 'none' }}>
          <GrainScatter />
        </div>

        {/* ── Logo header ── */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12, zIndex: 2 }}>
          <LogoMark />
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: -0.2 }}>Enechambs</div>
            <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.7)', marginTop: 1 }}>
              Foodstuff inventory · Central Market, Kaduna
            </div>
          </div>
        </div>

        {/* ── Center content ── */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          justifyContent: 'center', position: 'relative', zIndex: 2, marginTop: 12,
        }}>
          {/* Live badge */}
          <div style={{
            display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: 6,
            padding: '5px 11px', borderRadius: 999,
            background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)',
            fontSize: 11.5, fontWeight: 600, letterSpacing: 0.6,
            textTransform: 'uppercase', color: 'rgba(255,255,255,0.92)', marginBottom: 22,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: '#7ce0a4', flexShrink: 0 }} />
            Live · 248 SKUs tracked
          </div>

          {/* Headline */}
          <h2 style={{
            margin: 0, fontSize: 52, lineHeight: 1.05, fontWeight: 700,
            letterSpacing: -1.6, maxWidth: 480, color: '#fff',
          }}>
            From{' '}
            <span style={{ fontStyle: 'italic', color: '#ffd9a8' }}>Kaduna</span>
            {' '}Central market to your shelves —
            <br />in one place.
          </h2>

          {/* Description */}
          <p style={{
            marginTop: 18, fontSize: 15, lineHeight: 1.6,
            color: 'rgba(255,255,255,0.78)', maxWidth: 460, margin: '18px 0 0',
          }}>
            Track every bag of rice, jerrycan of palm oil and carton of stockfish.
            Run your foodstuff business with the clarity it deserves.
          </p>

          {/* Stat chips */}
          <div style={{ display: 'flex', gap: 10, marginTop: 28, flexWrap: 'wrap', maxWidth: 520 }}>
            <StatChip
              accent="rgba(255,217,168,0.22)"
              label="Today's Revenue"
              value="₦486,200"
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9 12 3l9 6v12H3Z" /><path d="M9 21V12h6v9" />
                </svg>
              }
            />
            <StatChip
              label="Items in stock"
              value="2,418"
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" />
                </svg>
              }
            />
            <StatChip
              accent="rgba(212,80,42,0.4)"
              label="Low stock alerts"
              value="4"
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2 1 22h22L12 2Z" /><path d="M12 9v5M12 18h.01" />
                </svg>
              }
            />
          </div>
        </div>

        {/* ── Testimonial ── */}
        <div style={{
          position: 'relative', zIndex: 2,
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '14px 16px', borderRadius: 14,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.12)',
          backdropFilter: 'blur(10px)', maxWidth: 520,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 999, flexShrink: 0,
            background: 'linear-gradient(135deg, #ffd9a8, #c44e2a)',
            display: 'grid', placeItems: 'center',
            color: '#fff', fontWeight: 700, fontSize: 13,
          }}>
            MO
          </div>
          <div style={{ flex: 1, fontSize: 13, lineHeight: 1.55, color: 'rgba(255,255,255,0.88)' }}>
            <span style={{ fontStyle: 'italic' }}>
              &ldquo;Enechambs sabi am — my stock count dey balance every single Friday.&rdquo;
            </span>
            <div style={{ marginTop: 4, fontSize: 11.5, color: 'rgba(255,255,255,0.6)' }}>
              Mama Ola · owner, Ola Foodstuff · Kaduna
            </div>
          </div>
        </div>

        {/* GrainBowl — foreground decoration */}
        <div style={{
          position: 'absolute', bottom: -30, right: -20,
          opacity: 0.95,
          filter: 'drop-shadow(0 30px 30px rgba(0,0,0,0.35))',
          zIndex: 1, pointerEvents: 'none',
        }}>
          <GrainBowl size={300} />
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          RIGHT PANEL — sign in form
          ═══════════════════════════════════════════════════════════ */}
      <div style={{
        flex: 1, background: '#fbfaf6',
        display: 'flex', flexDirection: 'column', position: 'relative',
      }}>
        {/* Corner link — desktop only */}
        <div className="hidden lg:block" style={{
          position: 'absolute', top: 28, right: 28,
          fontSize: 12, color: C.muted,
        }}>
          New here?{' '}
          <a style={{ color: C.green, fontWeight: 600, textDecoration: 'none', cursor: 'pointer' }}>
            Request access →
          </a>
        </div>

        {/* Mobile logo */}
        <div className="flex flex-col items-center pt-12 pb-2 lg:hidden">
          <LogoFull />
          <div style={{ marginTop: 10, fontWeight: 700, fontSize: 18, letterSpacing: -0.4, color: C.text }}>
            Enechambs
          </div>
          <div style={{ fontSize: 11.5, color: C.muted, marginTop: 3 }}>Food Inventory</div>
        </div>

        {/* ── Form ── */}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '40px 48px',
        }}>
          <form
            onSubmit={handleSubmit(onSubmit)}
            style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 22 }}
          >
            {/* Copy */}
            <div>
              <div style={{
                fontSize: 12, fontWeight: 600, color: C.green,
                letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 10,
              }}>
                Admin Console
              </div>
              <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700, letterSpacing: -0.8, color: C.text }}>
                Welcome back
              </h1>
              <p style={{ marginTop: 8, fontSize: 14, color: C.muted, lineHeight: 1.55 }}>
                Sign in to manage your foodstuff inventory, sales and team.
              </p>
            </div>

            {/* Fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Email */}
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: C.text, marginBottom: 7 }}>
                  Email address
                </div>
                <div style={{
                  height: 44, padding: '0 14px', borderRadius: 10,
                  border: `1px solid ${errors.email ? '#e53e3e' : C.border}`,
                  background: '#fff',
                  display: 'flex', alignItems: 'center', gap: 10,
                  boxShadow: '0 1px 0 rgba(15,26,20,0.02)',
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="m3 7 9 6 9-6" />
                  </svg>
                  <input
                    {...register("email")}
                    type="email"
                    placeholder="adaeze@enechambs.ng"
                    style={{
                      border: 'none', outline: 'none', background: 'transparent', flex: 1,
                      fontSize: 14, color: C.text, fontFamily: 'inherit',
                    }}
                  />
                </div>
                {errors.email && (
                  <p style={{ marginTop: 5, fontSize: 12, color: '#e53e3e' }}>{errors.email.message}</p>
                )}
              </div>

              {/* Password */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 7 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: C.text }}>Password</span>
                  <span style={{ flex: 1 }} />
                  <a style={{ fontSize: 12, color: C.green, fontWeight: 500, textDecoration: 'none', cursor: 'pointer' }}>
                    Forgot?
                  </a>
                </div>
                <div style={{
                  height: 44, padding: '0 14px', borderRadius: 10, background: '#fff',
                  display: 'flex', alignItems: 'center', gap: 10,
                  border: errors.password
                    ? '1px solid #e53e3e'
                    : pwFocused
                    ? `1.5px solid ${C.green}`
                    : `1px solid ${C.border}`,
                  boxShadow: errors.password
                    ? 'none'
                    : pwFocused
                    ? `0 0 0 3px ${C.green}1a`
                    : '0 1px 0 rgba(15,26,20,0.02)',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke={pwFocused ? C.green : C.muted}
                    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
                    style={{ flexShrink: 0, transition: 'stroke 0.15s' }}>
                    <rect x="4" y="11" width="16" height="10" rx="2" />
                    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                  </svg>
                  <input
                    {...register("password")}
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••••"
                    onFocus={() => setPwFocused(true)}
                    onBlur={() => setPwFocused(false)}
                    style={{
                      border: 'none', outline: 'none', background: 'transparent', flex: 1,
                      fontSize: 14, color: C.text, fontFamily: 'inherit',
                      letterSpacing: showPassword ? 'normal' : 2,
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', flexShrink: 0 }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      {showPassword ? (
                        <>
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </>
                      ) : (
                        <>
                          <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
                          <circle cx="12" cy="12" r="3" />
                        </>
                      )}
                    </svg>
                  </button>
                </div>
                {errors.password && (
                  <p style={{ marginTop: 5, fontSize: 12, color: '#e53e3e' }}>{errors.password.message}</p>
                )}
              </div>

              {/* Keep me signed in */}
              <label style={{
                display: 'flex', alignItems: 'center', gap: 8,
                fontSize: 13, color: C.text, cursor: 'pointer', marginTop: 2, userSelect: 'none',
              }}>
                <span style={{
                  width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                  border: `1.5px solid ${C.green}`, background: C.green,
                  display: 'grid', placeItems: 'center',
                }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m5 12 5 5L20 7" />
                  </svg>
                </span>
                Keep me signed in on this device
              </label>
            </div>

            {/* Sign in button */}
            <button
              type="submit"
              disabled={isLoading}
              style={{
                height: 46, borderRadius: 10, border: 'none',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                background: `linear-gradient(180deg, ${C.green} 0%, ${C.greenDeep} 100%)`,
                color: '#fff', fontSize: 14.5, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                fontFamily: 'inherit',
                boxShadow: `0 1px 0 rgba(255,255,255,0.15) inset, 0 4px 12px ${C.green}40`,
                opacity: isLoading ? 0.7 : 1,
                transition: 'opacity 0.15s',
              }}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  Signing in…
                </>
              ) : (
                <>
                  Sign in to Enechambs
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M13 5l7 7-7 7" />
                  </svg>
                </>
              )}
            </button>

            {/* Security + help row */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              fontSize: 12, color: C.muted, paddingTop: 4,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
                </svg>
                Encrypted login · NDPR-compliant
              </div>
              <div>
                Trouble?{' '}
                <a style={{ color: C.green, fontWeight: 600, textDecoration: 'none', cursor: 'pointer' }}>
                  Contact admin
                </a>
              </div>
            </div>
          </form>
        </div>

        {/* ── Page footer ── */}
        <div style={{
          padding: '20px 48px',
          borderTop: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: 11.5, color: C.muted,
        }}>
          <div>© 2026 Enechambs Ltd. RC 1284701</div>
          <div style={{ display: 'flex', gap: 16 }}>
            {['Terms', 'Privacy', 'Status'].map((l) => (
              <a key={l} style={{ color: C.muted, textDecoration: 'none', cursor: 'pointer' }}>{l}</a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
