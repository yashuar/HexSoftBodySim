// Debug.ts
// Minimal debug utility for structured logging

export class Debug {
  static enabled = true;

  static log(tag: string, ...args: any[]) {
    if (Debug.enabled) {
      console.log(`[DEBUG][${tag}]`, ...args);
    }
  }

  static warn(tag: string, ...args: any[]) {
    if (Debug.enabled) {
      console.warn(`[DEBUG][${tag}]`, ...args);
    }
  }

  static error(tag: string, ...args: any[]) {
    if (Debug.enabled) {
      console.error(`[DEBUG][${tag}]`, ...args);
    }
  }
}
