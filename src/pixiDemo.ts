import * as PIXI from 'pixi.js';

async function startPixiDemo() {
    let app: PIXI.Application;
    // @ts-ignore: Support both v8+ and v7-
    if (typeof PIXI.Application.init === 'function') {
        // PixiJS v8+
        // @ts-ignore
        app = await PIXI.Application.init({
            width: window.innerWidth,
            height: window.innerHeight,
            backgroundColor: 0x222244,
            antialias: true,
            resizeTo: window
        });
        document.body.appendChild(app.canvas);
    } else {
        // PixiJS v7-
        app = new PIXI.Application({
            width: window.innerWidth,
            height: window.innerHeight,
            backgroundColor: 0x222244,
            antialias: true,
            resizeTo: window
        });
        // @ts-ignore
        document.body.appendChild(app.view);
    }

    // Draw a hexagon at the center
    const hex = new PIXI.Graphics();
    const cx = app.screen.width / 2;
    const cy = app.screen.height / 2;
    const r = 80;
    hex.lineStyle(4, 0xffff00, 1);
    hex.beginFill(0x00ffcc, 0.5);
    for (let i = 0; i <= 6; i++) {
        const angle = Math.PI / 3 * i;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        if (i === 0) hex.moveTo(x, y);
        else hex.lineTo(x, y);
    }
    hex.endFill();
    app.stage.addChild(hex);

    // Draw a spring (line) between two points
    const spring = new PIXI.Graphics();
    spring.lineStyle(3, 0xff00ff, 1);
    spring.moveTo(cx - 100, cy - 100);
    spring.lineTo(cx + 100, cy + 100);
    app.stage.addChild(spring);

    // Responsive resize
    window.addEventListener('resize', () => {
        app.renderer.resize(window.innerWidth, window.innerHeight);
        // Optionally reposition graphics here
    });
}

startPixiDemo();
