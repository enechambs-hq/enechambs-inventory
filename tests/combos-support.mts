import type { HttpClient } from '../src/lib/combos/combos-api.ts';
import type { Combo, ComboImage } from '../src/types/combos.ts';

export interface RecordedCall {
  method: string;
  url: string;
  body?: unknown;
  params?: Record<string, unknown>;
}

/** An HttpClient double: records every call and answers from a queue of canned results. */
export function fakeHttp(responses: Array<unknown | Error> = []) {
  const calls: RecordedCall[] = [];
  const answer = async (method: string, url: string, body?: unknown, params?: Record<string, unknown>) => {
    calls.push({ method, url, body, params });
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return { data: next as never, status: 200 };
  };
  const http: HttpClient = {
    get: (url, config) => answer('GET', url, undefined, config?.params),
    post: (url, body) => answer('POST', url, body),
    put: (url, body) => answer('PUT', url, body),
    patch: (url, body) => answer('PATCH', url, body),
    delete: (url) => answer('DELETE', url),
  };
  return { http, calls };
}

/** What axios throws for a non-2xx response. */
export const httpError = (status: number, message: string | string[]) =>
  Object.assign(new Error(`Request failed with status code ${status}`), {
    response: { status, data: { success: false, message } },
  });

export const networkError = () => Object.assign(new Error('Network Error'), {});

export const image = (n: number, over: Partial<ComboImage> = {}): ComboImage => ({
  id: `00000000-0000-4000-8000-00000000000${n}`,
  url: `https://media.example.test/combos/${n}.png`,
  altText: '',
  displayOrder: n - 1,
  contentType: 'image/png',
  sizeBytes: 1000 * n,
  createdAt: '2026-11-03T10:00:00.000Z',
  ...over,
});

export const combo = (over: Partial<Combo> = {}): Combo => ({
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Festive Rice Combo',
  slug: 'festive-rice-combo',
  description: 'Rice and more',
  items: [
    { name: 'Rice', quantityLabel: '1 kg' },
    { name: 'Beans', quantityLabel: '2 kg' },
    { name: 'Garri', quantityLabel: null },
  ],
  price: 25000,
  referencePrice: 32000,
  totalQuantity: 100,
  remainingQuantity: 70,
  allocatedQuantity: 30,
  status: 'draft',
  customerAvailability: { status: 'available', label: 'Available' },
  images: [],
  createdAt: '2026-11-03T10:00:00.000Z',
  updatedAt: '2026-11-03T10:00:00.000Z',
  ...over,
});
