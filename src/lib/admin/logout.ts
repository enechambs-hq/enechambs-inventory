/**
 * The staff sign-out sequence. Whatever the server says, the person leaves the signed-in interface on this device: the
 * local session is cleared and they are sent to the sign-in page, so a failed request can never leave them in a
 * signed-in-looking screen. What differs is the message: success says so; a failure says honestly that the server could not
 * be told (the sign-out is recorded in the activity log, and the token is not revoked by that call).
 */
export interface LogoutSteps {
  /** The remote sign-out request. */
  remote: () => Promise<unknown>;
  /** Clears the local session (token, user, cookie). Returns false when a saved credential could not be removed. */
  clearLocal: () => boolean | void;
  /** Leaves the signed-in interface. */
  leave: () => void;
  notify: (kind: 'success' | 'warning', message: string) => void;
}

export const LOGOUT_OK = 'Logged out successfully';
export const LOGOUT_REMOTE_FAILED =
  'You have been signed out on this device, but we could not reach the server to complete the sign-out. If this is a shared device, please also close the browser.';

export const LOGOUT_STORAGE_FAILED =
  "You have been signed out of this page, but this browser would not let us remove your saved sign-in. Please clear this site's data (or close the browser) so the next person cannot use it.";
export const LOGOUT_BOTH_FAILED =
  "We could not complete the sign-out on the server, and this browser would not let us remove your saved sign-in. Please clear this site's data (or close the browser) before anyone else uses this device.";

export async function performLogout(steps: LogoutSteps): Promise<{ remoteOk: boolean; localOk: boolean }> {
  let remoteOk = true;
  let localOk = true;
  try {
    await steps.remote();
  } catch {
    remoteOk = false;
  }
  try {
    // `false` means a saved credential is still in this browser; a throw is treated the same way.
    localOk = steps.clearLocal() !== false;
  } catch {
    localOk = false;
  } finally {
    // Leaving always happens, so the person is never left on a signed-in screen.
    steps.leave();
  }
  if (remoteOk && localOk) steps.notify('success', LOGOUT_OK);
  else steps.notify('warning', !remoteOk && !localOk ? LOGOUT_BOTH_FAILED : !remoteOk ? LOGOUT_REMOTE_FAILED : LOGOUT_STORAGE_FAILED);
  return { remoteOk, localOk };
}
