// BufferManager: Handles creation, updating, and cleanup of GPU buffers for WebGL2.

export class BufferManager {
  private gl: WebGL2RenderingContext;
  public buffer: WebGLBuffer;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.buffer = gl.createBuffer()!;
  }

  bind(target: number) {
    this.gl.bindBuffer(target, this.buffer);
  }

  setData(target: number, data: Float32Array | Uint16Array, usage: number = this.gl.STREAM_DRAW) {
    this.gl.bindBuffer(target, this.buffer);
    this.gl.bufferData(target, data, usage);
  }

  delete() {
    this.gl.deleteBuffer(this.buffer);
  }
}
