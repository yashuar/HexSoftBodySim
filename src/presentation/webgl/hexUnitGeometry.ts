// hexUnitGeometry: Provides the unit hexagon geometry for instanced rendering.

export const HEX_UNIT_VERTICES = [
  0, 0, // center
  Math.cos(0), Math.sin(0),
  Math.cos(Math.PI / 3), Math.sin(Math.PI / 3),
  Math.cos(2 * Math.PI / 3), Math.sin(2 * Math.PI / 3),
  Math.cos(Math.PI), Math.sin(Math.PI),
  Math.cos(4 * Math.PI / 3), Math.sin(4 * Math.PI / 3),
  Math.cos(5 * Math.PI / 3), Math.sin(5 * Math.PI / 3),
  Math.cos(0), Math.sin(0) // close the fan
];

export const HEX_UNIT_VERTEX_COUNT = 8; // center + 7 (6 corners + repeat first)
