// SimpleUserInteraction.ts
// SIMPLIFIED ROBUST USER INTERACTION SYSTEM
// Single responsibility: Apply user interaction forces with proper damping

import { PointMass2D } from '../PointMass2D';
import { SIM_CONFIG } from '../../config';
import { DebugLogger } from '../../infrastructure/DebugLogger';
import { CoordinateTransform } from '../../application/CoordinateTransform';

export class SimpleUserInteraction {
  private _forceRealismScale: number = SIM_CONFIG.forceRealismScale;
  setForceRealismScale(val: number) { this._forceRealismScale = val; }
  getForceRealismScale() { return this._forceRealismScale; }
  private targetNode: PointMass2D;
  private targetPosition: { x: number; y: number };
  private isActive: boolean = false;
  private isReleasing: boolean = false;
  private releaseTimer: number = 0;
  private readonly releaseDuration: number = 0.5; // Longer, gentler release
  private coordinateTransform?: CoordinateTransform;
  
  // Simple, tuned parameters - much stronger forces to actually move nodes
  private readonly baseForceScreen: number = 500.0; // MASSIVELY INCREASED to actually move nodes
  private readonly maxDistanceScreen: number = 8.0; // REDUCED from 12.0 for better control
  private readonly dampingStrength: number = 0.2; // REDUCED to allow more movement

  // Logging and tracking
  private interactionStartTime: number = 0;
  private lastForce: number = 0;

  constructor(node: PointMass2D, initialTarget: { x: number; y: number }, coordinateTransform?: CoordinateTransform) {
    this.targetNode = node;
    this.targetPosition = { ...initialTarget };
    this.isActive = true;
    this.interactionStartTime = Date.now();
    this.coordinateTransform = coordinateTransform;
    
    // DEBUG: Log initial state
    this.debugSpringConnectivity("INTERACTION_START");
    
    // Log interaction start
    DebugLogger.log('user-interaction', 'Interaction started', {
      type: 'start',
      timestamp: this.interactionStartTime,
      nodeId: (node as any)._id || 'unknown',
      position: initialTarget
    });
  }

  // Update target position (mouse/touch move)
  updateTarget(newTarget: { x: number; y: number }): void {
    this.targetPosition = { ...newTarget };
    
    // ENHANCED LOGGING: Capture coordinate transformation details
    const nodeWorldPos = { x: this.targetNode.getPositionX(), y: this.targetNode.getPositionY() };
    const dx = newTarget.x - nodeWorldPos.x;
    const dy = newTarget.y - nodeWorldPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    DebugLogger.log('user-interaction', 'Target position updated', {
      type: 'move',
      timestamp: Date.now(),
      nodeId: (this.targetNode as any)._id || 'unknown',
      position: newTarget,
      nodeWorldPosition: nodeWorldPos,
      deltaFromNode: { dx, dy, distance },
      force: this.lastForce,
      velocity: { x: this.targetNode.getVelocityX(), y: this.targetNode.getVelocityY() }
    });
  }

  // Start gentle release process
  startRelease(): void {
    this.isReleasing = true;
    this.releaseTimer = 0;
    
    // DEBUG: Log state during release
    this.debugSpringConnectivity("INTERACTION_RELEASE");
    
    // Log interaction end
    DebugLogger.log('user-interaction', 'Release started', {
      type: 'end',
      timestamp: Date.now(),
      nodeId: (this.targetNode as any)._id || 'unknown',
      position: this.targetPosition,
      duration: Date.now() - this.interactionStartTime,
      force: this.lastForce,
      velocity: {
        x: this.targetNode.getVelocityX(),
        y: this.targetNode.getVelocityY()
      }
    });
  }

  // Update the interaction (called each frame)
  update(dt: number): boolean {
    if (!this.isActive) return false;

    if (this.isReleasing) {
      this.releaseTimer += dt;
      if (this.releaseTimer >= this.releaseDuration) {
        this.isActive = false;
        
        // Log release completion
        DebugLogger.log('user-interaction', 'Release completed', {
          type: 'release_complete',
          timestamp: Date.now(),
          nodeId: (this.targetNode as any)._id || 'unknown',
          position: this.targetPosition,
          duration: Date.now() - this.interactionStartTime,
          velocity: {
            x: this.targetNode.getVelocityX(),
            y: this.targetNode.getVelocityY()
          }
        });
        
        // DEBUG: Log final state
        this.debugSpringConnectivity("INTERACTION_COMPLETE");
        
        return false; // Interaction complete
      }
    }

    this.applyInteractionForce();
    return true; // Still active
  }

  private applyInteractionForce(): void {
    if (!this.isActive) return;

    // Calculate displacement vector
    const dx = this.targetPosition.x - this.targetNode.getPositionX();
    const dy = this.targetPosition.y - this.targetNode.getPositionY();
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 0.01) return; // Already at target

    // Get coordinate-appropriate force and distance limits
    const baseForce = this.getScaledBaseForce();
    const maxDistance = this.getScaledMaxDistance();

    // Prevent extreme forces
    const clampedDistance = Math.min(distance, maxDistance);
    const scale = clampedDistance / distance;
    const clampedDx = dx * scale;
    const clampedDy = dy * scale;

    // Calculate force magnitude (spring-like force proportional to distance)
    let forceMagnitude = baseForce * clampedDistance * 10.0; // MASSIVELY INCREASED from 1.0 to actually move nodes

    // Apply release scaling
    if (this.isReleasing) {
      const releaseProgress = this.releaseTimer / this.releaseDuration;
      // Gradual force reduction using smooth falloff
      const forceScale = Math.pow(1 - releaseProgress, 2); // Quadratic falloff
      forceMagnitude *= forceScale;
    }

    // Apply force realism scaling from config
    forceMagnitude *= this._forceRealismScale;

    // Calculate force components
    const forceX = (clampedDx / clampedDistance) * forceMagnitude;
    const forceY = (clampedDy / clampedDistance) * forceMagnitude;

    // Apply interaction force
    this.targetNode.addForce(forceX, forceY);
    
    // Store force for logging
    this.lastForce = Math.sqrt(forceX * forceX + forceY * forceY);
    
    // Apply gentle velocity damping through force-based damping instead of direct velocity modification
    // This allows gravity and other forces to work naturally during interaction
    const currentVelX = this.targetNode.getVelocityX();
    const currentVelY = this.targetNode.getVelocityY();
    
    let dampingFactor = this.dampingStrength;
    if (this.isReleasing) {
      // Stronger damping during release to dissipate momentum
      const releaseProgress = this.releaseTimer / this.releaseDuration;
      dampingFactor = 0.2 + releaseProgress * 0.3; // 20% to 50% damping
    }

    // Apply damping as a force rather than direct velocity modification
    // Force = -damping * velocity * mass (so it opposes current motion)
    const mass = this.targetNode.mass;
    const dampingForceX = -dampingFactor * currentVelX * mass;
    const dampingForceY = -dampingFactor * currentVelY * mass;
    
    // Apply damping force (this preserves physics integration)
    this.targetNode.addForce(dampingForceX, dampingForceY);
    
    // Periodically log force application for analysis (enhanced logging)
    if (Math.random() < 0.1) { // 10% sample rate
      DebugLogger.log('user-interaction', 'Force applied', {
        type: 'force_application',
        timestamp: Date.now(),
        nodeId: (this.targetNode as any)._id || 'unknown',
        force: this.lastForce,
        forceComponents: { fx: forceX, fy: forceY },
        dampingForceComponents: { fx: dampingForceX, fy: dampingForceY },
        distance: distance,
        clampedDistance: clampedDistance,
        displacement: { dx, dy },
        clampedDisplacement: { dx: clampedDx, dy: clampedDy },
        baseForce: this.getScaledBaseForce(),
        forceRealismScale: SIM_CONFIG.forceRealismScale,
        nodePosition: { x: this.targetNode.getPositionX(), y: this.targetNode.getPositionY() },
        targetPosition: this.targetPosition,
        nodeVelocity: { x: this.targetNode.getVelocityX(), y: this.targetNode.getVelocityY() },
        isReleasing: this.isReleasing,
        releaseProgress: this.isReleasing ? this.releaseTimer / this.releaseDuration : 0,
        dampingFactor: dampingFactor
      });
    }
  }

  // Coordinate-aware scaling methods with corrected force scaling
  private getScaledBaseForce(): number {
    if (this.coordinateTransform) {
      // Convert screen force to physics force using average scale factor
      const scaling = this.coordinateTransform.getScaling();
      const avgScale = (scaling.scaleX + scaling.scaleY) / 2;
      // CORRECTED: Force should scale linearly with distance scale, not area scale
      // Previous: force / (scale^2) was too aggressive
      // New: force / scale - more reasonable scaling
      return this.baseForceScreen / avgScale;
    }
    return this.baseForceScreen; // Fallback for old coordinate system
  }

  private getScaledMaxDistance(): number {
    if (this.coordinateTransform) {
      // Convert screen distance to physics distance
      return this.coordinateTransform.screenDistanceToPhysics(this.maxDistanceScreen);
    }
    return this.maxDistanceScreen; // Fallback for old coordinate system
  }

  // Check if this interaction is still active
  isActiveInteraction(): boolean {
    return this.isActive;
  }

  // Get the target node
  getTargetNode(): PointMass2D {
    return this.targetNode;
  }

  // Enhanced logging for debugging the spring decoupling issue
  private debugSpringConnectivity(prefix: string): void {
    if (!SIM_CONFIG.enableDebugLogging) return;
    
    // Get the node's connected springs (we need to access this somehow)
    const nodeId = (this.targetNode as any)._nodeId || (this.targetNode as any)._id || 'unknown';
    
    DebugLogger.log('user-interaction', `${prefix}: Node connectivity check`, {
      type: 'connectivity_debug',
      timestamp: Date.now(),
      nodeId: nodeId,
      nodePosition: { 
        x: this.targetNode.getPositionX(), 
        y: this.targetNode.getPositionY() 
      },
      nodeVelocity: { 
        x: this.targetNode.getVelocityX(), 
        y: this.targetNode.getVelocityY() 
      },
      targetPosition: this.targetPosition,
      isActive: this.isActive,
      isReleasing: this.isReleasing,
      lastForce: this.lastForce
    });
  }
}
