/**
 * Remembers that the person chose to sign out, so the access guard does not treat the resulting "no session" as an
 * interrupted visit: after a deliberate sign-out the next sign-in must not be taken back to the page that was left.
 * Cleared as soon as someone is signed in again.
 */
let active = false;
export const signOutIntent = {
  begin: () => {
    active = true;
  },
  clear: () => {
    active = false;
  },
  isActive: () => active,
};
