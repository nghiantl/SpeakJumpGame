export const TUTORIAL_KEY = 'speak-jump-tutorial-v1';
export function hasSeenTutorial(): boolean {
  try { return localStorage.getItem(TUTORIAL_KEY) === 'seen'; }
  catch { return false; }
}
export function markTutorialSeen(): void {
  try { localStorage.setItem(TUTORIAL_KEY, 'seen'); }
  catch { /* Private browsing may block storage. */ }
}
