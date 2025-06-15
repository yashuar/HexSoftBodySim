// ShaderProgram: Encapsulates shader compilation, linking, and uniform/attribute management for WebGL2.

export class ShaderProgram {
  private gl: WebGL2RenderingContext;
  public program: WebGLProgram;
  private vs: WebGLShader;
  private fs: WebGLShader;
  private attribLocationCache: Map<string, number> = new Map();
  private uniformLocationCache: Map<string, WebGLUniformLocation | null> = new Map();

  constructor(gl: WebGL2RenderingContext, vertexSrc: string, fragmentSrc: string) {
    this.gl = gl;
    this.vs = this.compileShader(gl.VERTEX_SHADER, vertexSrc);
    this.fs = this.compileShader(gl.FRAGMENT_SHADER, fragmentSrc);
    this.program = gl.createProgram()!;
    gl.attachShader(this.program, this.vs);
    gl.attachShader(this.program, this.fs);
    gl.linkProgram(this.program);
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(this.program) || 'Program link error');
    }
    // Detach and delete shaders after linking
    gl.detachShader(this.program, this.vs);
    gl.detachShader(this.program, this.fs);
    gl.deleteShader(this.vs);
    gl.deleteShader(this.fs);
  }

  private compileShader(type: number, source: string): WebGLShader {
    const shader = this.gl.createShader(type)!;
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      throw new Error(this.gl.getShaderInfoLog(shader) || 'Shader compile error');
    }
    return shader;
  }

  use() {
    this.gl.useProgram(this.program);
  }

  getAttribLocation(name: string): number {
    if (this.attribLocationCache.has(name)) {
      return this.attribLocationCache.get(name)!;
    }
    const loc = this.gl.getAttribLocation(this.program, name);
    if (loc === -1) {
      throw new Error(`Attribute '${name}' not found in shader program.`);
    }
    this.attribLocationCache.set(name, loc);
    return loc;
  }

  getUniformLocation(name: string): WebGLUniformLocation | null {
    if (this.uniformLocationCache.has(name)) {
      return this.uniformLocationCache.get(name)!;
    }
    const loc = this.gl.getUniformLocation(this.program, name);
    if (loc === null) {
      throw new Error(`Uniform '${name}' not found in shader program.`);
    }
    this.uniformLocationCache.set(name, loc);
    return loc;
  }

  dispose() {
    this.gl.deleteProgram(this.program);
    this.attribLocationCache.clear();
    this.uniformLocationCache.clear();
  }
}
