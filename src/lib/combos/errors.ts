/**
 * Turns whatever an API call threw into something an admin can act on.
 * The backend's own message is always preserved: it is specific (it names the
 * allocated unit count, the slug, the image limit). Guidance is added only
 * where the backend message alone does not say what to do next.
 */

export interface ApiProblem {
  /** HTTP status, or null when no response arrived (network failure, timeout). */
  status: number | null;
  /** Backend messages (class-validator can return several). Never empty. */
  messages: string[];
  /** The text to show. */
  message: string;
}

export type ProblemContext = 'save' | 'publish' | 'unpublish' | 'image' | 'load' | 'remove';

const GENERIC = 'Something went wrong. Please try again.';

interface ErrorLike {
  response?: { status?: number; data?: unknown };
  message?: string;
}

export function describeApiError(error: unknown): ApiProblem {
  const err = (error ?? {}) as ErrorLike;
  const status = typeof err.response?.status === 'number' ? err.response.status : null;
  const data = err.response?.data;

  let messages: string[] = [];
  if (data && typeof data === 'object') {
    const m = (data as { message?: unknown }).message;
    if (typeof m === 'string' && m.trim()) messages = [m.trim()];
    else if (Array.isArray(m)) messages = m.filter((x): x is string => typeof x === 'string' && !!x.trim());
  }

  if (status === null) {
    const text = 'Could not reach the server. Check your connection and try again.';
    return { status, messages: [text], message: text };
  }
  if (messages.length === 0) messages = [GENERIC];
  return { status, messages, message: messages.join(' ') };
}

/** Message plus the next step, for the given context. */
export function explainProblem(problem: ApiProblem, context: ProblemContext): string {
  const { status, message } = problem;

  if (status === 403) return 'Only administrators can manage promotional combos.';
  if (status === 503 && context === 'image') return IMAGE_STORAGE_UNAVAILABLE;
  if (status === 404 && context !== 'image') {
    return 'This combo could not be found, or promotions are not enabled on the server.';
  }
  if (status === 409 && context === 'publish') {
    return `${message} Add at least one image in the Images section, then publish again.`;
  }
  if (status === 409 && context === 'save') {
    return `${message} Nothing was changed.`;
  }
  if (status !== null && status >= 500) {
    return `The server could not complete this request (${status}). Please try again.`;
  }
  return message;
}

export const IMAGE_STORAGE_UNAVAILABLE =
  'Image storage is not configured or is unavailable on the server, so images cannot be uploaded right now. ' +
  'You can still save this combo’s other details. Ask whoever manages the deployment to finish configuring image storage.';
