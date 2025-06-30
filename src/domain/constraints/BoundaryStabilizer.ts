// BoundaryStabilizer: Advanced boundary handling techniques from Box2D and Matter.js
// Implements soft boundary constraints, collision response, and boundary-aware damping

import { PointMass2D } from '../PointMass2D';
import { HexCell } from '../HexCell';
import { HexSoftBody } from '../HexSoftBody';
import { SIM_CONFIG } from '../../config';

interface BoundaryViolation {
  node: PointMass2D;
  violation: { x: number; y: number }; // How far outside bounds
  penetrationDepth: number;
  normal: { x: number; y: number }; // Surface normal
  restitution: number; // Bounce factor
}

interface BoundaryZone {
  type: 'soft' | 'hard';
  bounds: { left: number; right: number; top: number; bottom: number };
  damping: number;
  compliance: number; // For soft constraints
}

export class BoundaryStabilizer {
  private boundaryZones: BoundaryZone[] = [];
  private violations: BoundaryViolation[] = [];
  
  // Box2D-inspired boundary parameters (reduced aggressiveness to minimize oscillations)
  private readonly restitution = 0.1; // Reduced bounce factor (was 0.3)
  private readonly friction = 0.9; // Increased friction to absorb energy (was 0.8)
  private readonly softZoneWidth = 100; // Width of soft boundary zone
  private readonly maxPenetration = 30; // Increased tolerance before hard correction (was 20)
  
  constructor() {
    this.setupBoundaryZones();
    console.log('[BoundaryStabilizer] Initialized with Box2D-style boundary handling');
  }
  
  /**
   * Setup boundary zones based on canvas size
   */
  private setupBoundaryZones(): void {
    const canvasWidth = window?.innerWidth || 1920;
    const canvasHeight = window?.innerHeight || 1080;
    const margin = 50;
    
    // Soft boundary zone (warns and gently pushes back)
    this.boundaryZones.push({
      type: 'soft',
      bounds: {
        left: -margin,
        right: canvasWidth + margin,
        top: -margin,
        bottom: canvasHeight + margin
      },
      damping: 0.95, // Increased damping near boundaries (was 0.9)
      compliance: 2e-4 // Softer constraint (was 1e-4)
    });
    
    // Hard boundary zone (emergency stop)
    this.boundaryZones.push({
      type: 'hard',
      bounds: {
        left: -margin - this.softZoneWidth,
        right: canvasWidth + margin + this.softZoneWidth,
        top: -margin - this.softZoneWidth,
        bottom: canvasHeight + margin + this.softZoneWidth
      },
      damping: 0.7, // Increased damping for hard boundaries (was 0.5)
      compliance: 1e-6 // Very stiff constraint
    });
  }
  
  /**
   * Main boundary processing - detects violations and applies corrections
   */
  processBoundaries(bodies: HexSoftBody[], dt: number): void {
    this.violations = [];
    
    // 1. Detect boundary violations
    for (const body of bodies) {
      for (const node of body.nodes) {
        this.detectBoundaryViolations(node);
      }
    }
    
    // 2. Apply boundary corrections
    for (const violation of this.violations) {
      this.applyBoundaryCorrection(violation, dt);
    }
    
    // 3. Log boundary statistics
    if (this.violations.length > 0) {
      console.warn('[BoundaryStabilizer] Boundary violations detected', {
        violationCount: this.violations.length,
        maxPenetration: Math.max(...this.violations.map(v => v.penetrationDepth)),
        averagePenetration: this.violations.reduce((sum, v) => sum + v.penetrationDepth, 0) / this.violations.length
      });
    }
  }
  
  /**
   * Detect if a node violates any boundary zones
   */
  private detectBoundaryViolations(node: PointMass2D): void {
    for (const zone of this.boundaryZones) {
      const violation = this.checkZoneViolation(node, zone);
      if (violation) {
        this.violations.push(violation);
        break; // Only handle the first (innermost) violation
      }
    }
  }
  
  /**
   * Check if node violates a specific boundary zone
   */
  private checkZoneViolation(node: PointMass2D, zone: BoundaryZone): BoundaryViolation | null {
    const pos = node.position;
    let violationX = 0;
    let violationY = 0;
    let normalX = 0;
    let normalY = 0;
    
    // Check X boundaries
    if (pos.x < zone.bounds.left) {
      violationX = zone.bounds.left - pos.x;
      normalX = 1; // Point inward
    } else if (pos.x > zone.bounds.right) {
      violationX = pos.x - zone.bounds.right;
      normalX = -1; // Point inward
    }
    
    // Check Y boundaries
    if (pos.y < zone.bounds.top) {
      violationY = zone.bounds.top - pos.y;
      normalY = 1; // Point inward
    } else if (pos.y > zone.bounds.bottom) {
      violationY = pos.y - zone.bounds.bottom;
      normalY = -1; // Point inward
    }
    
    const penetrationDepth = Math.max(violationX, violationY);
    
    if (penetrationDepth > 0) {
      // Normalize the normal vector
      const normalLength = Math.sqrt(normalX * normalX + normalY * normalY) || 1;
      
      return {
        node,
        violation: { x: violationX, y: violationY },
        penetrationDepth,
        normal: { x: normalX / normalLength, y: normalY / normalLength },
        restitution: zone.type === 'soft' ? this.restitution * 0.5 : this.restitution
      };
    }
    
    return null;
  }
  
  /**
   * Apply boundary correction using Box2D-style collision response
   */
  private applyBoundaryCorrection(violation: BoundaryViolation, dt: number): void {
    const node = violation.node;
    const normal = violation.normal;
    
    // 1. Position correction (separate overlapping objects)
    this.applyPositionCorrection(violation);
    
    // 2. Velocity correction (collision response)
    this.applyVelocityCorrection(violation);
    
    // 3. Additional damping for boundary regions
    this.applyBoundaryDamping(violation);
  }
  
  /**
   * Position correction to separate node from boundary
   */
  private applyPositionCorrection(violation: BoundaryViolation): void {
    const node = violation.node;
    const normal = violation.normal;
    const penetration = violation.penetrationDepth;
    
    // Move node out of boundary by penetration distance plus small margin
    const correctionMagnitude = penetration + 1.0;
    
    node.position.x += normal.x * correctionMagnitude;
    node.position.y += normal.y * correctionMagnitude;
  }
  
  /**
   * Velocity correction for collision response (Box2D approach)
   */
  private applyVelocityCorrection(violation: BoundaryViolation): void {
    const node = violation.node;
    const normal = violation.normal;
    
    // Velocity along normal (toward boundary)
    const velocityNormal = node.velocity.x * normal.x + node.velocity.y * normal.y;
    
    if (velocityNormal < 0) { // Moving toward boundary
      // Apply collision response with restitution
      const impulse = -(1 + violation.restitution) * velocityNormal;
      
      node.velocity.x += impulse * normal.x;
      node.velocity.y += impulse * normal.y;
      
      // Apply friction to tangential velocity
      const tangentX = -normal.y;
      const tangentY = normal.x;
      const velocityTangent = node.velocity.x * tangentX + node.velocity.y * tangentY;
      
      const frictionImpulse = -this.friction * velocityTangent;
      node.velocity.x += frictionImpulse * tangentX;
      node.velocity.y += frictionImpulse * tangentY;
    }
  }
  
  /**
   * Apply additional damping near boundaries
   */
  private applyBoundaryDamping(violation: BoundaryViolation): void {
    const node = violation.node;
    const dampingFactor = 1.0 - Math.min(violation.penetrationDepth / this.softZoneWidth, 1.0) * 0.3;
    
    node.velocity.x *= dampingFactor;
    node.velocity.y *= dampingFactor;
  }
  
  /**
   * Adaptive boundary zones based on simulation state
   */
  updateBoundaryZones(bodies: HexSoftBody[]): void {
    // Calculate current simulation extents
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    for (const body of bodies) {
      for (const node of body.nodes) {
        minX = Math.min(minX, node.position.x);
        maxX = Math.max(maxX, node.position.x);
        minY = Math.min(minY, node.position.y);
        maxY = Math.max(maxY, node.position.y);
      }
    }
    
    // Expand boundaries if simulation is growing
    const canvasWidth = window?.innerWidth || 1920;
    const canvasHeight = window?.innerHeight || 1080;
    const margin = 50;
    
    const extentWidth = maxX - minX;
    const extentHeight = maxY - minY;
    
    // If simulation is larger than canvas, expand boundaries
    if (extentWidth > canvasWidth || extentHeight > canvasHeight) {
      const expandFactor = 1.2;
      const newWidth = Math.max(canvasWidth, extentWidth * expandFactor);
      const newHeight = Math.max(canvasHeight, extentHeight * expandFactor);
      
      // Update soft boundary
      this.boundaryZones[0].bounds = {
        left: -margin,
        right: newWidth + margin,
        top: -margin,
        bottom: newHeight + margin
      };
      
      console.log('[BoundaryStabilizer] Expanded boundary zones', {
        newWidth,
        newHeight,
        originalCanvas: { width: canvasWidth, height: canvasHeight },
        simulationExtent: { width: extentWidth, height: extentHeight }
      });
    }
  }
  
  /**
   * Special handling for cells crossing boundaries
   */
  processCellBoundaries(cells: HexCell[]): void {
    for (const cell of cells) {
      const center = cell.center;
      const bounds = this.boundaryZones[0].bounds; // Use soft boundary
      
      // Check if cell center is outside bounds
      if (center.x < bounds.left || center.x > bounds.right ||
          center.y < bounds.top || center.y > bounds.bottom) {
        
        // Apply soft constraint to pull cell back
        const targetX = Math.max(bounds.left, Math.min(center.x, bounds.right));
        const targetY = Math.max(bounds.top, Math.min(center.y, bounds.bottom));
        
        const correctionX = (targetX - center.x) * 0.1; // Gentle correction
        const correctionY = (targetY - center.y) * 0.1;
        
        // Apply correction to all nodes of the cell
        for (const node of cell.nodes) {
          node.position.x += correctionX;
          node.position.y += correctionY;
          
          // Also apply some damping
          node.velocity.x *= 0.9;
          node.velocity.y *= 0.9;
        }
        
        console.warn('[BoundaryStabilizer] Cell boundary correction applied', {
          cellCenter: center,
          target: { x: targetX, y: targetY },
          correction: { x: correctionX, y: correctionY }
        });
      }
    }
  }
  
  /**
   * Emergency boundary enforcement for extreme cases
   */
  emergencyBoundaryEnforcement(bodies: HexSoftBody[]): void {
    const hardBounds = this.boundaryZones[1].bounds; // Use hard boundary
    let enforcementCount = 0;
    
    for (const body of bodies) {
      for (const node of body.nodes) {
        let needsEnforcement = false;
        
        // Hard clamp positions
        if (node.position.x < hardBounds.left) {
          node.position.x = hardBounds.left;
          node.velocity.x = Math.max(0, node.velocity.x); // Only allow outward velocity
          needsEnforcement = true;
        } else if (node.position.x > hardBounds.right) {
          node.position.x = hardBounds.right;
          node.velocity.x = Math.min(0, node.velocity.x);
          needsEnforcement = true;
        }
        
        if (node.position.y < hardBounds.top) {
          node.position.y = hardBounds.top;
          node.velocity.y = Math.max(0, node.velocity.y);
          needsEnforcement = true;
        } else if (node.position.y > hardBounds.bottom) {
          node.position.y = hardBounds.bottom;
          node.velocity.y = Math.min(0, node.velocity.y);
          needsEnforcement = true;
        }
        
        if (needsEnforcement) {
          enforcementCount++;
          // Additional damping for enforced nodes
          node.velocity.x *= 0.5;
          node.velocity.y *= 0.5;
        }
      }
    }
    
    if (enforcementCount > 0) {
      console.error('[BoundaryStabilizer] Emergency boundary enforcement', {
        enforcedNodes: enforcementCount,
        hardBounds
      });
    }
  }
  
  /**
   * Get boundary statistics for debugging
   */
  getBoundaryStats(): any {
    return {
      boundaryZones: this.boundaryZones.length,
      currentViolations: this.violations.length,
      softZoneWidth: this.softZoneWidth,
      restitution: this.restitution,
      friction: this.friction,
      bounds: this.boundaryZones.map(zone => ({
        type: zone.type,
        bounds: zone.bounds,
        damping: zone.damping
      }))
    };
  }
}
