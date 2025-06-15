// NodeRenderer: Handles node/point rendering.
import { ShaderProgram } from './ShaderProgram';
import { BufferManager } from './BufferManager';
import { Camera } from './Camera';
import { HexSoftBody } from '../../domain/HexSoftBody';

export class NodeRenderer {
  private gl: WebGL2RenderingContext;
  private shader: ShaderProgram;
  private posBuffer: BufferManager;
  private colorBuffer: BufferManager;
  private vao: WebGLVertexArrayObject | null;

  constructor(gl: WebGL2RenderingContext, shader: ShaderProgram) {
    this.gl = gl;
    this.shader = shader;
    this.posBuffer = new BufferManager(gl);
    this.colorBuffer = new BufferManager(gl);
    this.vao = gl.createVertexArray();
  }

  render(body: HexSoftBody, camera: Camera) {
    const gl = this.gl;
    this.shader.use();
    const positions: number[] = [];
    const colors: number[] = [];
    for (const node of body.nodes) {
      const [x, y] = camera.worldToNDC(node.position.x, node.position.y);
      positions.push(x, y);
      colors.push(0.13, 0.13, 0.13, 1);
    }
    this.posBuffer.setData(gl.ARRAY_BUFFER, new Float32Array(positions));
    this.colorBuffer.setData(gl.ARRAY_BUFFER, new Float32Array(colors));

    gl.bindVertexArray(this.vao);
    // Position attribute
    this.posBuffer.bind(gl.ARRAY_BUFFER);
    const a_position = this.shader.getAttribLocation('a_position');
    gl.enableVertexAttribArray(a_position);
    gl.vertexAttribPointer(a_position, 2, gl.FLOAT, false, 0, 0);
    // Color attribute
    this.colorBuffer.bind(gl.ARRAY_BUFFER);
    const a_color = this.shader.getAttribLocation('a_color');
    gl.enableVertexAttribArray(a_color);
    gl.vertexAttribPointer(a_color, 4, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.POINTS, 0, body.nodes.length);
    gl.bindVertexArray(null);
  }

  dispose() {
    this.posBuffer.delete();
    this.colorBuffer.delete();
    if (this.vao) this.gl.deleteVertexArray(this.vao);
  }
}
