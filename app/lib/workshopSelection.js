/* Remember which child to expand on the home page after story creation or editing, keyed by account. */
const selectionKey = "storypal.workshop-return-child";

/** Read which child to expand on this visit. */
export function getWorkshopChild(uid) {
  if (!uid) return null;
  try {
    return window.sessionStorage.getItem(`${selectionKey}.${uid}`);
  } catch {
    return null;
  }
}

/** Remember which child to expand when returning from story creation or editing. */
export function saveWorkshopChild(uid, childId) {
  if (!uid || !childId) return;
  try {
    window.sessionStorage.setItem(`${selectionKey}.${uid}`, childId);
  } catch {
    // Fall back to expanding the first child when session storage is unavailable.
  }
}

/** Clear the selection after the home page reads it. */
export function clearWorkshopChild(uid) {
  if (!uid) return;
  try {
    window.sessionStorage.removeItem(`${selectionKey}.${uid}`);
  } catch {
    // Skip cleanup when session storage is unavailable.
  }
}
