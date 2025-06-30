// debugListeners.ts: Debug event listeners and console interception for development

const DEBUG = false; // Set to false to disable debug logs and console interception

// Session ID for tracking related logs
const SESSION_ID = Math.random().toString(36).substring(2, 15);
let logBuffer: any[] = [];
let logTimer: number | null = null;

import { DebugLogger } from './infrastructure/DebugLogger';
// Original console methods
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  info: console.info
};

async function flushLogBuffer() {
  if (logBuffer.length === 0) return;
  
  try {
    const response = await fetch('/api/console-log', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sessionId: SESSION_ID,
        timestamp: new Date().toISOString(),
        logs: [...logBuffer]
      })
    });
    
    if (response.ok) {
      originalConsole.info(`[DebugLogger] Flushed ${logBuffer.length} logs to file`);
    } else {
      originalConsole.warn('[DebugLogger] Failed to write logs:', response.statusText);
    }
  } catch (error) {
    originalConsole.warn('[DebugLogger] Network error writing logs:', error);
  }
  
  logBuffer = [];
}

function bufferLog(level: string, args: any[]) {
  logBuffer.push({
    level,
    timestamp: new Date().toISOString(),
    message: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' '),
    args: args.map(arg => {
      try {
        return typeof arg === 'object' ? JSON.parse(JSON.stringify(arg)) : arg;
      } catch {
        return String(arg);
      }
    })
  });
  
  // Debounced flush - flush after 2 seconds of inactivity or when buffer gets large
  if (logTimer) clearTimeout(logTimer);
  
  if (logBuffer.length >= 50) {
    // Immediate flush for large buffers
    flushLogBuffer();
  } else {
    // Debounced flush
    logTimer = window.setTimeout(flushLogBuffer, 2000);
  }
}

function setupConsoleInterception() {
  if (!DEBUG) return;
  
  // Intercept console.log
  console.log = function(...args: any[]) {
    originalConsole.log.apply(console, args);
    bufferLog('log', args);
    DebugLogger.log('system-event', '[console.log intercepted]', { args });
  };
  // Intercept console.warn
  console.warn = function(...args: any[]) {
    originalConsole.warn.apply(console, args);
    bufferLog('warn', args);
    DebugLogger.log('system-event', '[console.warn intercepted]', { args });
  };
  // Intercept console.error
  console.error = function(...args: any[]) {
    originalConsole.error.apply(console, args);
    bufferLog('error', args);
    DebugLogger.log('system-event', '[console.error intercepted]', { args });
  };
  // Intercept console.info
  console.info = function(...args: any[]) {
    originalConsole.info.apply(console, args);
    bufferLog('info', args);
    DebugLogger.log('system-event', '[console.info intercepted]', { args });
  };
  
  // Flush on page unload
  window.addEventListener('beforeunload', () => {
    if (logBuffer.length > 0) {
      flushLogBuffer();
    }
  });
  
  originalConsole.info('[DebugLogger] Console interception enabled, session:', SESSION_ID);
}

export function registerGlobalDebugListeners() {
  setupConsoleInterception();
  
  if (!DEBUG) return;
  
  window.addEventListener('mousedown', (e) => {
    DebugLogger.log('user-interaction', '[GLOBAL DEBUG] mousedown', { x: e.clientX, y: e.clientY, target: e.target });
  });
  window.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    if (t) DebugLogger.log('user-interaction', '[GLOBAL DEBUG] touchstart', { x: t.clientX, y: t.clientY, target: e.target });
  });
}

// Export for manual control
export function flushLogsNow() {
  return flushLogBuffer();
}

export function getSessionId() {
  return SESSION_ID;
}
