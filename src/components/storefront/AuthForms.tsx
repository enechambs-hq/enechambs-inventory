'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { codeError, emailError, nameError, normaliseEmail, passwordError, phoneError } from '@/lib/storefront/auth-forms';
import { loginHref, registerHref, safeNextPath } from '@/lib/storefront/redirects';
import { friendlyMessage, storeRequest } from '@/lib/storefront/store-client';
import PasswordField from './PasswordField';
import { btnPrimary, Field, linkClass, Notice } from './ui';

const ok = () => true as const;
type Errors = Record<string, string | null>;
const hasErrors = (e: Errors) => Object.values(e).some(Boolean);

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
    if (hasErrors(found)) return;
    setBusy(true);
    const r = await storeRequest({ path: 'auth/login', method: 'POST', body: { email: normaliseEmail(email), password }, parse: ok });
    if (r.ok) return finish();
    setBusy(false);
    setFailure(friendlyMessage(r));
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {failure && <Notice tone="error">{failure}</Notice>}
      <Field id="email" label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
      <PasswordField id="password" label="Password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} />
      <button type="submit" disabled={busy} className={`${btnPrimary} w-full`}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
      <p className="text-center text-sm text-[#5d5645]">
        <Link href="/account/forgot-password" className={linkClass}>
          Forgot your password?
        </Link>
      </p>
      <p className="text-center text-sm text-[#5d5645]">
        New here?{' '}
        <Link href={registerHref(next)} className={linkClass}>
          Create an account
        </Link>
      </p>
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
    if (hasErrors(found)) return;
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
    if (hasErrors(found)) return;
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
      <form onSubmit={submitDetails} noValidate className="space-y-4">
        {failure && <Notice tone="error">{failure}</Notice>}
        <Field id="name" label="Full name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
        <Field id="email" label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} hint="We will email you a code to confirm it is yours." />
        <Field id="phone" label="Phone number" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} error={errors.phone} hint="We use it to reach you about your order." />
        <PasswordField id="password" label="Password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} hint="8+ characters with upper and lower case and a number or symbol." />
        <button type="submit" disabled={busy} className={`${btnPrimary} w-full`}>
          {busy ? 'Sending code…' : 'Create account'}
        </button>
        <p className="text-center text-sm text-[#5d5645]">
          Already have an account?{' '}
          <Link href={loginHref(next)} className={linkClass}>
            Sign in
          </Link>
        </p>
      </form>
    );
  }

  return (
    <form onSubmit={verify} noValidate className="space-y-4">
      {info && <Notice tone="info">{info}</Notice>}
      {failure && <Notice tone="error">{failure}</Notice>}
      <Field id="code" label="Six-digit code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} error={errors.code} />
      <button type="submit" disabled={busy} className={`${btnPrimary} w-full`}>
        {busy ? 'Verifying…' : 'Verify and sign in'}
      </button>
      <div className="flex justify-between text-sm">
        <button type="button" disabled={busy} onClick={resend} className={linkClass}>
          Send the code again
        </button>
        <button type="button" disabled={busy} onClick={() => { setStep('details'); setInfo(null); setFailure(null); setErrors({}); }} className={linkClass}>
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
    if (hasErrors(found)) return;
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
    if (hasErrors(found)) return;
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
      <div className="space-y-4">
        <Notice tone="success">Your password has been changed. Please sign in with the new one.</Notice>
        <Link href="/account/login" className={`${btnPrimary} w-full`}>
          Sign in
        </Link>
      </div>
    );
  }

  if (step === 'email') {
    return (
      <form onSubmit={sendCode} noValidate className="space-y-4">
        {failure && <Notice tone="error">{failure}</Notice>}
        <Field id="email" label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
        <button type="submit" disabled={busy} className={`${btnPrimary} w-full`}>
          {busy ? 'Sending…' : 'Send me a code'}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={reset} noValidate className="space-y-4">
      <Notice tone="info">If that email has an account, a code is on its way.</Notice>
      {failure && <Notice tone="error">{failure}</Notice>}
      <Field id="code" label="Six-digit code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} error={errors.code} />
      <Field id="password" label="New password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} />
      <button type="submit" disabled={busy} className={`${btnPrimary} w-full`}>
        {busy ? 'Saving…' : 'Change password'}
      </button>
    </form>
  );
}
