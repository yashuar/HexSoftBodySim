import { Application, Container, Ticker } from 'pixi.js';
import { DebugLogger } from '../../infrastructure/DebugLogger';

/**
 * Robust, modular PixiJS renderer for 2D physics engine visualizations.
 * - PixiJS v8+ best practices: async init, app.canvas, app.ticker, asset loading.
 * - v7 fallback for legacy support.
 * - Generic layer management, resize, and clean lifecycle.
 */
export class PixiRenderer2D {
    /** The underlying PixiJS Application instance. */
    readonly app: Application;
    /** Map of named layers (views) for extensibility. */
    private layers: Map<string, Container> = new Map();
    /** The parent DOM element for the canvas. */
    private parent: HTMLElement;
    private resizeHandler: (() => void) | undefined;
    private destroyed = false;
    private tickerHandler: ((ticker: Ticker) => void) | undefined;

    /**
     * Private constructor. Use PixiRenderer2D.create() to instantiate.
     */
    private constructor(app: Application, parent: HTMLElement) {
        this.app = app;
        this.parent = parent;
        this.setupResizeHandler();

        // Enable PixiJS stage interactivity after DOM insertion
        this.app.stage.eventMode = 'static';
        this.app.stage.interactive = true;
        this.app.stage.on('pointerdown', (event: any) => {
            const { x, y } = event;
            DebugLogger.log('user-interaction', '[PixiRenderer2D] pointerdown', { x, y, target: event.target });
        });
        DebugLogger.log('user-interaction', '[PixiRenderer2D] Stage interactivity enabled and pointerdown handler attached.', {});
    }

    /**
     * Async factory for PixiRenderer2D. PixiJS v8+ and v7 fallback.
     * @param options PixiJS Application options
     * @param parent Optional parent element or selector for canvas (defaults to document.body)
     */
    static async create(options?: Partial<ConstructorParameters<typeof Application>[0]>, parent?: HTMLElement | string): Promise<PixiRenderer2D> {
        let app: Application;
        // PixiJS v8+
        if (typeof Application.prototype.init === 'function') {
            app = new Application();
            // @ts-ignore
            await app.init({
                width: options?.width ?? 800,
                height: options?.height ?? 600,
                background: options?.background ?? 0x222244,
                ...options,
            });
        } else {
            // PixiJS v7 fallback
            // @ts-ignore
            app = new Application({
                width: options?.width ?? 800,
                height: options?.height ?? 600,
                backgroundColor: options?.backgroundColor ?? 0x222244,
                ...options,
            });
        }
        let parentElem: HTMLElement;
        if (!parent) {
            parentElem = document.body;
        } else if (typeof parent === 'string') {
            const found = document.querySelector(parent);
            if (!found || !(found instanceof HTMLElement)) throw new Error(`Parent selector not found: ${parent}`);
            parentElem = found;
        } else {
            parentElem = parent;
        }
        // DOM insertion: v8+ app.canvas, v7 app.view/app.renderer.view
        let canvas: HTMLCanvasElement | undefined = undefined;
        // @ts-ignore
        if ('canvas' in app && app.canvas) {
            // PixiJS v8+
            // @ts-ignore
            canvas = app.canvas;
        } else if ('view' in app && app.view) {
            // PixiJS v7-
            // @ts-ignore
            canvas = app.view;
        } else if ('renderer' in app && app.renderer && 'view' in app.renderer) {
            // PixiJS v7 fallback
            // @ts-ignore
            canvas = app.renderer.view;
        }
        if (canvas && !canvas.parentNode) parentElem.appendChild(canvas);
        return new PixiRenderer2D(app, parentElem);
    }

    /**
     * Add or replace a named layer (view) to the stage.
     * @param name Unique layer name
     * @param container PIXI.Container (e.g., HexGridView, SpringView)
     */
    addLayer(name: string, container: Container) {
        if (this.layers.has(name)) {
            this.app.stage.removeChild(this.layers.get(name)!);
        }
        this.layers.set(name, container);
        this.app.stage.addChild(container);
    }

    /**
     * Remove a named layer from the stage.
     * @param name Layer name
     */
    removeLayer(name: string) {
        const layer = this.layers.get(name);
        if (layer) {
            this.app.stage.removeChild(layer);
            this.layers.delete(name);
        }
    }

    /**
     * Get a named layer (if present).
     */
    getLayer(name: string): Container | undefined {
        return this.layers.get(name);
    }

    /**
     * Resize the renderer and canvas.
     */
    resize(width: number, height: number) {
        this.app.renderer.resize(width, height);
    }

    /**
     * Add a function to the animation ticker. Use for frame updates.
     * @param fn Function called with deltaTime (frame-scaled)
     */
    addTicker(fn: (dt: number) => void) {
        if (this.tickerHandler) this.removeTicker();
        // PixiJS v8+ ticker expects a function with (ticker: Ticker)
        this.tickerHandler = (ticker: Ticker) => {
            fn(ticker.deltaTime);
        };
        this.app.ticker.add(this.tickerHandler);
    }

    /**
     * Remove the current ticker handler, if any.
     */
    removeTicker() {
        if (this.tickerHandler) {
            this.app.ticker.remove(this.tickerHandler);
            this.tickerHandler = undefined;
        }
    }

    /**
     * Clean up all resources and remove canvas from DOM.
     */
    destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
        }
        this.removeTicker();
        this.app.destroy(true, { children: true, texture: true });
        // Remove canvas from DOM (v8/v7)
        let canvas: HTMLCanvasElement | undefined = undefined;
        // @ts-ignore
        if ('canvas' in this.app && this.app.canvas) {
            // PixiJS v8+
            // @ts-ignore
            canvas = this.app.canvas;
        } else if ('view' in this.app && this.app.view) {
            // PixiJS v7-
            // @ts-ignore
            canvas = this.app.view;
        } else if ('renderer' in this.app && this.app.renderer && 'view' in this.app.renderer) {
            // PixiJS v7 fallback
            // @ts-ignore
            canvas = this.app.renderer.view;
        }
        if (canvas && canvas.parentNode) {
            canvas.parentNode.removeChild(canvas);
        }
        this.layers.clear();
    }

    /**
     * Internal: Setup window resize handler.
     */
    private setupResizeHandler() {
        this.resizeHandler = () => {
            const w = window.innerWidth;
            const h = window.innerHeight;
            this.resize(w, h);
        };
        window.addEventListener('resize', this.resizeHandler);
    }

    /**
     * Add a filter to a named layer or the stage.
     * @param name Layer name or 'stage'
     * @param filter PIXI.Filter instance
     */
    addFilter(name: string, filter: any) {
        const target = name === 'stage' ? this.app.stage : this.layers.get(name);
        if (target) {
            if (!target.filters) target.filters = [filter];
            else target.filters = [...target.filters, filter];
        }
    }

    /**
     * Remove all filters from a named layer or the stage.
     * @param name Layer name or 'stage'
     */
    clearFilters(name: string) {
        const target = name === 'stage' ? this.app.stage : this.layers.get(name);
        if (target) target.filters = null;
    }

    /**
     * Enable or disable interaction for a layer or the whole stage.
     * @param name Layer name or 'stage'
     * @param enabled true to enable, false to disable
     */
    setInteractive(name: string, enabled: boolean) {
        const target = name === 'stage' ? this.app.stage : this.layers.get(name);
        if (target) target.interactive = enabled;
    }

    /**
     * Remove all layers from the stage and clear the map.
     */
    clearLayers() {
        for (const layer of this.layers.values()) {
            this.app.stage.removeChild(layer);
        }
        this.layers.clear();
    }

    /**
     * Reorder layers by a given array of names (topmost last).
     * @param order Array of layer names
     */
    reorderLayers(order: string[]) {
        for (const name of order) {
            const layer = this.layers.get(name);
            if (layer) {
                this.app.stage.removeChild(layer);
                this.app.stage.addChild(layer);
            }
        }
    }

    /**
     * Helper: Load an asset (texture, json, etc) using PixiJS Assets API.
     * @param url Asset URL or alias
     * @returns Promise resolving to the loaded asset
     */
    async loadAsset(url: string) {
        // Dynamically import Assets to avoid forcing it as a dependency if not needed
        const { Assets } = await import('pixi.js');
        return Assets.load(url);
    }

    /**
     * Get the HTMLCanvasElement used by PixiJS.
     */
    getCanvas(): HTMLCanvasElement | undefined {
        // @ts-ignore
        if ('canvas' in this.app && this.app.canvas) {
            // PixiJS v8+
            // @ts-ignore
            return this.app.canvas;
        } else if ('view' in this.app && this.app.view) {
            // PixiJS v7-
            // @ts-ignore
            return this.app.view;
        } else if ('renderer' in this.app && this.app.renderer && 'view' in this.app.renderer) {
            // PixiJS v7 fallback
            // @ts-ignore
            return this.app.renderer.view;
        }
        return undefined;
    }
}
