// debugListeners.ts: Debug event listeners for development

const DEBUG = false; // Set to false to disable debug logs

export function registerGlobalDebugListeners() {
  if (!DEBUG) return;
  window.addEventListener('mousedown', (e) => {
    console.log('[GLOBAL DEBUG] mousedown at', e.clientX, e.clientY, e.target);
  });
  window.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    if (t) console.log('[GLOBAL DEBUG] touchstart at', t.clientX, t.clientY, e.target);
  });
}
