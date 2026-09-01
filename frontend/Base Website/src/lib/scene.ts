/**
 * Module-level scene store shared by the persistent WebGL canvas and the
 * pages. The canvas lerps `intensity` toward `target` every frame, so
 * lowering the target before a route push morphs the liquid-glass scenery
 * seamlessly – there is never a blank frame between the Gateway and Home.
 */
export const scene = { intensity: 0.6, target: 0.6 };

export const GATEWAY_SCENE = 1;
export const SITE_SCENE = 0.55;

export function setScene(v: number) {
  scene.target = v;
}
