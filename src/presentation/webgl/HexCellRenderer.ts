// HexCellRenderer: Handles hex mesh drawing, color mapping, and instancing.
import { ShaderProgram } from './ShaderProgram';
import { BufferManager } from './BufferManager';
import { Camera } from './Camera';
import { HexSoftBody } from '../../domain/HexSoftBody';
import { HEX_UNIT_VERTICES, HEX_UNIT_VERTEX_COUNT } from './hexUnitGeometry';

export class HexCellRenderer {
  private gl: WebGL2RenderingContext;
  private shader: ShaderProgram;
  private unitHexBuffer: WebGLBuffer;
  private instancePosBuffer: WebGLBuffer;
  private instanceColorBuffer: WebGLBuffer;

  constructor(gl: WebGL2RenderingContext, shader: ShaderProgram) {
    this.gl = gl;
    this.shader = shader;
    // Create and upload unit hex geometry
    this.unitHexBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.unitHexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(HEX_UNIT_VERTICES), gl.STATIC_DRAW);
    // Create instance buffers
    this.instancePosBuffer = gl.createBuffer()!;
    this.instanceColorBuffer = gl.createBuffer()!;
  }

  render(body: HexSoftBody, camera: Camera) {
    const gl = this.gl;
    this.shader.use();
    // Prepare per-instance data
    const instancePositions: number[] = [];
    const instanceScales: number[] = [];
    const instanceColors: number[] = [];
    for (const cell of body.cells) {
      const center = cell.getCentroid();
      const node = cell.nodes[0].position;
      const dx = node.x - center.x;
      const dy = node.y - center.y;
      const scale = Math.sqrt(dx * dx + dy * dy);
      instancePositions.push(center.x, center.y); // world coordinates
      instanceScales.push(scale); // correct scale
      const color = this.getColorByStiffness(cell.stiffness);
      instanceColors.push(...color);
      // Debug: log color and stiffness for outlier values
      if (cell.stiffness < 0.5 || cell.stiffness > 5) {
        console.warn('[DEBUG] Cell at', cell.center, 'has unusual stiffness:', cell.stiffness, 'color:', color);
      }
    }
    // Upload instance data
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instancePosBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(instancePositions), gl.DYNAMIC_DRAW);
    const a_instancePos = this.shader.getAttribLocation('a_instancePos');
    gl.enableVertexAttribArray(a_instancePos);
    gl.vertexAttribPointer(a_instancePos, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(a_instancePos, 1);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceColorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(instanceColors), gl.DYNAMIC_DRAW);
    const a_instanceColor = this.shader.getAttribLocation('a_instanceColor');
    gl.enableVertexAttribArray(a_instanceColor);
    gl.vertexAttribPointer(a_instanceColor, 4, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(a_instanceColor, 1);

    // Instance scale buffer
    const instanceScaleBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceScaleBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(instanceScales), gl.DYNAMIC_DRAW);
    const a_instanceScale = this.shader.getAttribLocation('a_instanceScale');
    gl.enableVertexAttribArray(a_instanceScale);
    gl.vertexAttribPointer(a_instanceScale, 1, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(a_instanceScale, 1);

    // Bind unit hex geometry
    gl.bindBuffer(gl.ARRAY_BUFFER, this.unitHexBuffer);
    const a_position = this.shader.getAttribLocation('a_position');
    gl.enableVertexAttribArray(a_position);
    gl.vertexAttribPointer(a_position, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(a_position, 0);

    // Draw instanced hexes
    const instanceCount = body.cells.length;
    gl.drawArraysInstanced(gl.TRIANGLE_FAN, 0, HEX_UNIT_VERTEX_COUNT, instanceCount);

    // Cleanup instance scale buffer
    gl.deleteBuffer(instanceScaleBuffer);
  }

  private getColorByStiffness(stiffness: number): [number, number, number, number] {
    const t = Math.min(Math.max((stiffness - 1) / 9, 0), 1);
    return [t, 0, 1 - t, 1];
  }

  dispose() {
    this.gl.deleteBuffer(this.unitHexBuffer);
    this.gl.deleteBuffer(this.instancePosBuffer);
    this.gl.deleteBuffer(this.instanceColorBuffer);
    // No need to delete instanceScaleBuffer, it's deleted after use in render
  }
}
