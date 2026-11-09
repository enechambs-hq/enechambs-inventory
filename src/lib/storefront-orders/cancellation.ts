/**
 * The staff screen's side of paid-order cancellation (manual full refund). Pure;
 * relative imports only (node:test loads this).
 *
 * Everything here only decides what to SHOW and what to check before sending.
 * The backend decides eligibility and flags (`order.cancellation.can*`) and
 * re-validates everything; this module never invents an action the backend did
 * not offer, and never reports a transition the backend has not confirmed.
 */
import type { AdminCancellation, AdminOrderDetail } from '../../types/storefront-orders.ts';

export const MIN_CANCEL_REASON = 3;
export const MAX_CANCEL_REASON = 400;

/** Must match the backend's refundReference rule (3-100 of letters, digits . _ : / -, no spaces). */
export const REFUND_REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{2,99}$/;

export function cancelReasonError(value: string): string | null {
  const v = value.trim();
  if (v.length === 0) return 'Enter the reason for cancelling this order.';
  if (v.length < MIN_CANCEL_REASON) return `The reason must be at least ${MIN_CANCEL_REASON} characters.`;
  if (v.length > MAX_CANCEL_REASON) return `The reason must be at most ${MAX_CANCEL_REASON} characters.`;
  return null;
}

export function refundReferenceError(value: string): string | null {
  const v = value.trim();
  if (v.length === 0) return 'Enter the Flutterwave refund reference.';
  if (/\s/.test(v)) return 'The reference cannot contain spaces. Copy it exactly from Flutterwave.';
  if (!REFUND_REFERENCE_PATTERN.test(v)) return 'The reference must be 3 to 100 characters: letters, digits and . _ : / - only.';
  return null;
}

export type CancellationPanel =
  | { mode: 'hidden' }
  /** Eligible paid order: offer "Request cancellation". */
  | { mode: 'request' }
  /** Requested, manual refund NOT started: it can still be withdrawn. */
  | { mode: 'requested'; reason: string; refundAmount: number | null; canStartRefund: boolean; canWithdraw: boolean; blockedReason: string | null }
  /** Manual refund started: no withdrawal. Record the completed refund, or record that it failed. */
  | { mode: 'refund_started'; reason: string; refundAmount: number | null; canRecordRefund: boolean; canRecordFailedRefund: boolean; blockedReason: string | null }
  | { mode: 'completed' };

/**
 * What the cancellation panel shows. Only an administrator is offered actions
 * (`canDecide`); staff still SEE a pending or completed cancellation, read-only.
 */
export function cancellationPanel(order: Pick<AdminOrderDetail, 'cancellation'>, canDecide: boolean): CancellationPanel {
  const c: AdminCancellation | undefined = order.cancellation;
  if (!c) return { mode: 'hidden' };
  if (c.state === 'completed') return { mode: 'completed' };
  if (c.state === 'requested') {
    return {
      mode: 'requested',
      reason: c.reason ?? '',
      refundAmount: c.refundAmount,
      canStartRefund: canDecide && c.canStartRefund,
      canWithdraw: canDecide && c.canWithdraw,
      blockedReason: c.blockedReason,
    };
  }
  if (c.state === 'refund_started') {
    return {
      mode: 'refund_started',
      reason: c.reason ?? '',
      refundAmount: c.refundAmount,
      canRecordRefund: canDecide && c.canRecordRefund,
      canRecordFailedRefund: canDecide && c.canRecordFailedRefund,
      blockedReason: c.blockedReason,
    };
  }
  return canDecide && c.canRequest ? { mode: 'request' } : { mode: 'hidden' };
}

export type GuardResult<T> = { status: 'skipped' } | { status: 'ok'; value: T } | { status: 'error'; error: unknown };

/**
 * One submission at a time. A second click (or Enter) while a request is in
 * flight is ignored, so a double click can never send two requests. State lives
 * in a closure, so it also works across React re-renders when kept in a ref.
 */
export function createSubmitGuard() {
  let inFlight = false;
  return {
    get busy() {
      return inFlight;
    },
    async run<T>(action: () => Promise<T>): Promise<GuardResult<T>> {
      if (inFlight) return { status: 'skipped' };
      inFlight = true;
      try {
        return { status: 'ok', value: await action() };
      } catch (error) {
        return { status: 'error', error };
      } finally {
        inFlight = false;
      }
    },
  };
}

export interface DecisionHandlers<T> {
  /** Called ONLY with what the backend returned, after it confirmed the change. */
  onApplied: (value: T) => void;
  /** Called with a ready-to-show message; the dialog stays open and keeps what was typed. */
  onFailed: (message: string) => void;
}

/**
 * Runs one decision (request, record refund, withdraw) behind the guard.
 * Success is reported only after the backend answered; a failure never closes
 * the dialog or clears the form (the handlers decide what is shown), and a
 * second submission while one is in flight is ignored entirely.
 */
export async function runDecision<T>(
  guard: ReturnType<typeof createSubmitGuard>,
  action: () => Promise<T>,
  toMessage: (error: unknown) => string,
  handlers: DecisionHandlers<T>,
): Promise<'applied' | 'failed' | 'ignored'> {
  const result = await guard.run(action);
  if (result.status === 'skipped') return 'ignored';
  if (result.status === 'error') {
    handlers.onFailed(toMessage(result.error));
    return 'failed';
  }
  handlers.onApplied(result.value);
  return 'applied';
}
