/**
 * The admin combo API, written against a minimal HTTP interface so it can be
 * tested without a browser. `src/lib/services/combos.service.ts` wires it to
 * the existing axios client (staff JWT, admin proxy). This module has only
 * relative imports on purpose: the node:test suite loads it directly.
 *
 * Backend base path: /admin/combos (the axios baseURL already ends in /api/v1).
 */
import type {
  Combo,
  ComboImage,
  ComboListResponse,
  CreateComboPayload,
  ListCombosParams,
  PresignResponse,
  UpdateComboPayload,
} from '../../types/combos.ts';
import { LIST_PAGE_SIZE, MAX_SEARCH_LENGTH } from './constants.ts';

export interface HttpClient {
  get<T>(url: string, config?: { params?: Record<string, unknown> }): Promise<{ data: T; status: number }>;
  post<T>(url: string, body?: unknown): Promise<{ data: T; status: number }>;
  put<T>(url: string, body?: unknown): Promise<{ data: T; status: number }>;
  patch<T>(url: string, body?: unknown): Promise<{ data: T; status: number }>;
  delete<T>(url: string): Promise<{ data: T; status: number }>;
}

const BASE = '/admin/combos';

/** Only parameters the backend accepts, and only when they carry a value. */
export function buildListParams(input: ListCombosParams = {}): Record<string, string | number> {
  const params: Record<string, string | number> = {
    page: Number.isInteger(input.page) && (input.page as number) >= 1 ? (input.page as number) : 1,
    limit:
      Number.isInteger(input.limit) && (input.limit as number) >= 1
        ? Math.min(input.limit as number, 100)
        : LIST_PAGE_SIZE,
  };
  if (input.status) params.status = input.status;
  const q = (input.q ?? '').trim().slice(0, MAX_SEARCH_LENGTH);
  if (q) params.q = q;
  return params;
}

export function createCombosApi(http: HttpClient) {
  const id = (value: string) => encodeURIComponent(value);

  return {
    list: async (params: ListCombosParams = {}): Promise<ComboListResponse> =>
      (await http.get<ComboListResponse>(BASE, { params: buildListParams(params) })).data,

    get: async (comboId: string): Promise<Combo> =>
      (await http.get<Combo>(`${BASE}/${id(comboId)}`)).data,

    create: async (payload: CreateComboPayload): Promise<Combo> =>
      (await http.post<Combo>(BASE, payload)).data,

    update: async (comboId: string, payload: UpdateComboPayload): Promise<Combo> =>
      (await http.patch<Combo>(`${BASE}/${id(comboId)}`, payload)).data,

    publish: async (comboId: string): Promise<Combo> =>
      (await http.post<Combo>(`${BASE}/${id(comboId)}/publish`)).data,

    unpublish: async (comboId: string): Promise<Combo> =>
      (await http.post<Combo>(`${BASE}/${id(comboId)}/unpublish`)).data,

    presignImage: async (
      comboId: string,
      body: { contentType: string; sizeBytes: number },
    ): Promise<PresignResponse> =>
      (await http.post<PresignResponse>(`${BASE}/${id(comboId)}/images/presign`, body)).data,

    confirmImage: async (
      comboId: string,
      body: { uploadId: string; altText?: string },
    ): Promise<ComboImage> =>
      (await http.post<ComboImage>(`${BASE}/${id(comboId)}/images/confirm`, body)).data,

    reorderImages: async (comboId: string, imageIds: string[]): Promise<ComboImage[]> =>
      (await http.put<ComboImage[]>(`${BASE}/${id(comboId)}/images/order`, { imageIds })).data,

    updateImageAlt: async (comboId: string, imageId: string, altText: string): Promise<ComboImage> =>
      (await http.patch<ComboImage>(`${BASE}/${id(comboId)}/images/${id(imageId)}`, { altText })).data,

    removeImage: async (comboId: string, imageId: string): Promise<void> => {
      await http.delete<void>(`${BASE}/${id(comboId)}/images/${id(imageId)}`);
    },
  };
}

export type CombosApi = ReturnType<typeof createCombosApi>;
