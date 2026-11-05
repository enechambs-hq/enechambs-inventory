/**
 * Client for the backend's e2e control server (enechambs-api test/e2e/e2e-server.ts).
 * It exists only in the test environment: it seeds data, plays the customer
 * finishing or failing a payment on the (scripted) hosted page, runs the
 * notification worker, and reads database facts for assertions.
 */
const CONTROL = `http://127.0.0.1:${process.env.E2E_CONTROL_PORT ?? 4311}`;

export async function ctl<T = unknown>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(CONTROL + path, body === undefined ? undefined : { method: 'POST', body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`control ${path} failed: HTTP ${response.status}`);
  return (await response.json()) as T;
}

export interface StaffTokens {
  admin: { token: string; user: Record<string, unknown> };
  staff: { token: string; user: Record<string, unknown> };
}

export interface Seed {
  orders: { paid: string; awaiting: string; late: string; lateForRefund: string; mismatch: string; duplicate: string; processing: string };
  adaToken: string;
  adaEmail: string;
  bolaEmail: string;
}

export interface OrderFact { orderNumber: string; status: string; paymentStatus: string; reviewReason: string | null; restored: boolean }
export interface MailFact { to: string; subject: string; key: string; html: string }

export const stockOf = async (slug: string): Promise<number> => (await ctl<Array<{ slug: string; r: number }>>('/stock')).find((s) => s.slug === slug)!.r;
export const orderFact = async (orderNumber: string): Promise<OrderFact> =>
  (await ctl<OrderFact[]>('/orders')).find((o) => o.orderNumber === orderNumber)!;
