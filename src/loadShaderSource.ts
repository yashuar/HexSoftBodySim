// loadShaderSource.ts
// Utility to load shader source code from a file (async)

export async function loadShaderSource(path: string): Promise<string> {
  // In a real app, use fetch or import.meta.url, or a bundler loader
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Failed to load shader: ${path}`);
  return await response.text();
}
