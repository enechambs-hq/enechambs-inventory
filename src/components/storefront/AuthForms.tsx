'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ComponentProps, type FormEvent, type ReactNode } from 'react';
import { codeError, emailError, nameError, normaliseEmail, passwordError, phoneError } from '@/lib/storefront/auth-forms';
import { loginHref, registerHref, safeNextPath } from '@/lib/storefront/redirects';
import { friendlyMessage, storeRequest } from '@/lib/storefront/store-client';
import PasswordField from './PasswordField';


const ok = () => true as const;
type Errors = Record<string, string | null>;
const hasErrors = (e: Errors) => Object.values(e).some(Boolean);

// Large presentation for the sign-in pages (16px text, 48px controls). Local on purpose: the shared Field and buttons stay as they are.
const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a7a4a]';
const primary = `inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#0f4f2d] px-6 text-base font-bold text-white transition hover:bg-[#14693f] disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;
const linkText = `inline-flex min-h-11 items-center justify-center px-2 text-base font-medium text-[#1a7a4a] underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;
const TONES = {
  error: 'border-[#e4b4ae] bg-[#fdf1ef] text-[#8a2a1d]',
  info: 'border-[#cfe3d6] bg-[#eef7f1] text-[#14693f]',
  success: 'border-[#b9dcc6] bg-[#e5f4ea] text-[#0f4f2d]',
} as const;

function Notice({ tone, children }: { tone: keyof typeof TONES; children: ReactNode }) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-base ${TONES[tone]}`}>
      {children}
    </div>
  );
}

/** The page frame: its own 1280px container and a centred 448px column under the heading. */
export function AuthFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-[80rem] px-4 py-8 sm:px-6 md:py-12 lg:px-8">
      <div className="mx-auto max-w-md">
        <h1 className="text-3xl font-bold tracking-tight text-[#0f4f2d] sm:text-4xl">{title}</h1>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, hint, error, id, code, ...input }: { label: string; hint?: string; error?: string | null; id: string; code?: boolean } & ComponentProps<'input'>) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined;
  return (
    <div>
      <label htmlFor={id} className="text-base font-semibold text-[#1d2a22]">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`mt-1.5 block min-h-12 w-full scroll-mt-28 rounded-xl border bg-white px-4 py-3 text-[#1d2a22] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#1a7a4a] ${
          code ? 'text-xl tracking-[0.15em]' : 'text-base'
        } ${error ? 'border-2 border-[#8a2a1d]' : 'border-[#d9ccaf]'}`}
        {...input}
      />
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-sm text-[#5d5645]">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-base font-medium text-[#8a2a1d]">
          {error}
        </p>
      )}
    </div>
  );
}

const prompt = 'flex flex-wrap items-center justify-center text-base text-[#5d5645]';

/** No return path is invented: the reset pages carry none, so this is the plain sign-in page. */
function BackToSignIn() {
  return (
    <div className="flex flex-col items-center">
      <Link href="/account/login" className={linkText}>
        Back to sign in
      </Link>
    </div>
  );
}

/** After a failed custom validation: say so once, and put the cursor in the first invalid field (field ids match the error keys). */
function Summary({ errors }: { errors: Errors }) {
  return hasErrors(errors) ? (
    <p role="alert" className="text-base font-medium text-[#8a2a1d]">
      Please fix the highlighted fields.
    </p>
  ) : null;
}
function focusFirstInvalid(found: Errors) {
  const first = Object.keys(found).find((key) => found[key]);
  if (first) window.setTimeout(() => document.getElementById(first)?.focus(), 0);
}

/** After a session starts: go where the visitor was heading, else the landing page. The cart is untouched. */
function useFinish(next: string | undefined) {
  const router = useRouter();
  return () => {
    router.push(safeNextPath(next, '/'));
    router.refresh();
  };
}

export function LoginForm({ next }: { next?: string }) {
  const finish = useFinish(next);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const found = { email: emailError(email), password: password ? null : 'Enter your password.' };
    setErrors(found);
    setFailure(null);
    if (hasErrors(found)) return focusFirstInvalid(found);
    setBusy(true);
    const r = await storeRequest({ path: 'auth/login', method: 'POST', body: { email: normaliseEmail(email), password }, parse: ok });
    if (r.ok) return finish();
    setBusy(false);
    setFailure(friendlyMessage(r));
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {failure && <Notice tone="error">{failure}</Notice>}
      <Field id="email" label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
      <PasswordField id="password" label="Password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} />
      <Summary errors={errors} />
      <button type="submit" disabled={busy} className={primary}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
      <div className="flex flex-col items-center">
        <Link href="/account/forgot-password" className={linkText}>
          Forgot your password?
        </Link>
        <p className={prompt}>
          New here?
          <Link href={registerHref(next)} className={linkText}>
            Create an account
          </Link>
        </p>
      </div>
    </form>
  );
}

/**
 * Registration: the customer fills in and submits the whole form first. Only
 * then is a code emailed (`register` takes ONLY the email), and the next screen
 * asks for that code. `verify-email` takes the code together with the details
 * held here, creates the account and signs in. Nothing is sent before submit.
 */
export function RegisterForm({ next }: { next?: string }) {
  const finish = useFinish(next);
  const [step, setStep] = useState<'details' | 'code'>('details');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submitDetails(e: FormEvent) {
    e.preventDefault();
    const found = { name: nameError(name), email: emailError(email), phone: phoneError(phone), password: passwordError(password) };
    setErrors(found);
    setFailure(null);
    if (hasErrors(found)) return focusFirstInvalid(found);
    setBusy(true);
    const r = await storeRequest({ path: 'storefront/auth/register', method: 'POST', body: { email: normaliseEmail(email) }, parse: ok });
    setBusy(false);
    if (!r.ok) return setFailure(friendlyMessage(r));
    setCode('');
    setErrors({});
    setInfo(`We sent a six-digit code to ${normaliseEmail(email)}.`);
    setStep('code');
  }

  async function resend() {
    setFailure(null);
    setBusy(true);
    const r = await storeRequest({ path: 'storefront/auth/resend-code', method: 'POST', body: { email: normaliseEmail(email) }, parse: ok });
    setBusy(false);
    if (!r.ok) return setFailure(friendlyMessage(r));
    setInfo('A new code is on its way. Use the newest one.');
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    const found = { code: codeError(code) };
    setErrors(found);
    setFailure(null);
    if (hasErrors(found)) return focusFirstInvalid(found);
    setBusy(true);
    const r = await storeRequest({
      path: 'auth/verify-email',
      method: 'POST',
      body: { email: normaliseEmail(email), code: code.trim(), customerName: name.trim(), customerPhone: phone.trim(), password },
      parse: ok,
    });
    if (r.ok) return finish();
    setBusy(false);
    setFailure(friendlyMessage(r));
  }

  if (step === 'details') {
    return (
      <form onSubmit={submitDetails} noValidate className="space-y-5">
        {failure && <Notice tone="error">{failure}</Notice>}
        <Field id="name" label="Full name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
        <Field id="email" label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} hint="We will email you a code to confirm it is yours." />
        <Field id="phone" label="Phone number" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} error={errors.phone} hint="We use it to reach you about your order." />
        <PasswordField id="password" label="Password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} hint="8+ characters with upper and lower case and a number or symbol." />
        <Summary errors={errors} />
        <button type="submit" disabled={busy} className={primary}>
          {busy ? 'Sending code…' : 'Create account'}
        </button>
        <p className={prompt}>
          Already have an account?
          <Link href={loginHref(next)} className={linkText}>
            Sign in
          </Link>
        </p>
      </form>
    );
  }

  return (
    <form onSubmit={verify} noValidate className="space-y-5">
      {info && <Notice tone="info">{info}</Notice>}
      {failure && <Notice tone="error">{failure}</Notice>}
      <Field code id="code" label="Six-digit code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} error={errors.code} />
      <Summary errors={errors} />
      <button type="submit" disabled={busy} className={primary}>
        {busy ? 'Verifying…' : 'Verify and sign in'}
      </button>
      <div className="flex flex-col items-center">
        <button type="button" disabled={busy} onClick={resend} className={linkText}>
          Send the code again
        </button>
        <button type="button" disabled={busy} onClick={() => { setStep('details'); setInfo(null); setFailure(null); setErrors({}); }} className={linkText}>
          Change my details
        </button>
      </div>
    </form>
  );
}

/** Reset does NOT sign the customer in: after it they sign in normally. */
export function ForgotPasswordForm() {
  const [step, setStep] = useState<'email' | 'reset' | 'done'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    const found = { email: emailError(email) };
    setErrors(found);
    setFailure(null);
    if (hasErrors(found)) return focusFirstInvalid(found);
    setBusy(true);
    const r = await storeRequest({ path: 'storefront/auth/forgot-password', method: 'POST', body: { email: normaliseEmail(email) }, parse: ok });
    setBusy(false);
    if (!r.ok) return setFailure(friendlyMessage(r));
    setStep('reset');
  }

  async function reset(e: FormEvent) {
    e.preventDefault();
    const found = { code: codeError(code), password: passwordError(password) };
    setErrors(found);
    setFailure(null);
    if (hasErrors(found)) return focusFirstInvalid(found);
    setBusy(true);
    const r = await storeRequest({
      path: 'storefront/auth/reset-password',
      method: 'POST',
      body: { email: normaliseEmail(email), code: code.trim(), newPassword: password },
      parse: ok,
    });
    setBusy(false);
    if (!r.ok) return setFailure(friendlyMessage(r));
    setStep('done');
  }

  if (step === 'done') {
    return (
      <div className="space-y-5">
        <Notice tone="success">Your password has been changed. Please sign in with the new one.</Notice>
        <Link href="/account/login" className={primary}>
          Sign in
        </Link>
      </div>
    );
  }

  if (step === 'email') {
    return (
      <form onSubmit={sendCode} noValidate className="space-y-5">
        {failure && <Notice tone="error">{failure}</Notice>}
        <Field id="email" label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
        <Summary errors={errors} />
        <button type="submit" disabled={busy} className={primary}>
          {busy ? 'Sending…' : 'Send me a code'}
        </button>
        <BackToSignIn />
      </form>
    );
  }

  return (
    <form onSubmit={reset} noValidate className="space-y-5">
      <Notice tone="info">If that email has an account, a code is on its way.</Notice>
      {failure && <Notice tone="error">{failure}</Notice>}
      <Field code id="code" label="Six-digit code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} error={errors.code} />
      <Field id="password" label="New password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} />
      <Summary errors={errors} />
      <button type="submit" disabled={busy} className={primary}>
        {busy ? 'Saving…' : 'Change password'}
      </button>
      <BackToSignIn />
    </form>
  );
}
