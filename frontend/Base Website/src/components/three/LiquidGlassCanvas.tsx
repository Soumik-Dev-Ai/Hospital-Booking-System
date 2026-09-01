"use client";

import { useEffect, useRef } from "react";
import { scene } from "@/lib/scene";

const VERT = `
attribute vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2  uResolution;
uniform float uTime;
uniform vec2  uMouse;
uniform float uIntensity;

float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float noise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise2(p);
    p = p * 2.03 + vec2(11.7, 7.3);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 res = uResolution;
  vec2 uv = frag / res;
  float aspect = res.x / res.y;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);
  float t = uTime;

  // Slow, graceful liquid-glass metaballs
  vec2 b1 = vec2(cos(t * 0.21) * 0.42, sin(t * 0.17) * 0.30) + uMouse * 0.06;
  vec2 b2 = vec2(cos(t * 0.13 + 2.1) * 0.50, sin(t * 0.19 + 1.0) * 0.38);
  vec2 b3 = vec2(cos(t * 0.09 + 4.2) * 0.62, sin(t * 0.12 + 3.0) * 0.46);
  vec2 b4 = vec2(cos(t * 0.16 + 1.3) * 0.38, sin(t * 0.23 + 5.2) * 0.52);

  float d1 = length(p - b1);
  float d2 = length(p - b2);
  float d3 = length(p - b3);
  float d4 = length(p - b4);

  float m1 = smoothstep(0.46, 0.06, d1);
  float m2 = smoothstep(0.52, 0.08, d2);
  float m3 = smoothstep(0.58, 0.10, d3);
  float m4 = smoothstep(0.34, 0.05, d4);

  float rim1 = smoothstep(0.40, 0.50, d1) * (1.0 - smoothstep(0.50, 0.62, d1));
  float rim2 = smoothstep(0.42, 0.52, d2) * (1.0 - smoothstep(0.52, 0.64, d2));

  // Domain-warped liquid interior
  vec2 w = vec2(
    fbm(p * 1.5 + vec2(0.0, t * 0.6)),
    fbm(p * 1.5 + vec2(5.2, 1.3) - t * 0.5)
  );
  float liquid  = fbm(p * 1.6 + w * 2.4 + t * 0.25);
  float liquid2 = fbm(p * 2.6 + w * 3.2 - t * 0.33);

  // Palette – forest, sage, alabaster, gold
  vec3 forest = vec3(0.028, 0.106, 0.075);
  vec3 deep   = vec3(0.013, 0.052, 0.039);
  vec3 sage   = vec3(0.42, 0.55, 0.45);
  vec3 alaba  = vec3(0.955, 0.945, 0.912);
  vec3 gold   = vec3(0.72, 0.57, 0.38);

  vec3 col = mix(deep, forest, liquid);

  // Milky alabaster glass bodies
  float bodies = clamp(m1 * 0.62 + m2 * 0.50 + m3 * 0.42 + m4 * 0.55, 0.0, 1.0);
  col = mix(col, alaba, bodies * 0.44 * uIntensity);

  // Inner liquid tint
  col = mix(col, sage, liquid2 * 0.16 * uIntensity);

  // Refraction edge lights on the glass rims
  float edge = clamp(rim1 + rim2, 0.0, 1.0);
  col += alaba * edge * 0.10;

  // Gold glints
  col += gold * pow(liquid2, 5.0) * 0.10 * uIntensity;
  col += gold * pow(noise2(p * 28.0 + vec2(t, -t) * 1.3), 8.0) * 0.05;

  // Caustic threads
  float caust = smoothstep(0.63, 0.685, liquid) * (1.0 - smoothstep(0.66, 0.72, liquid));
  col += alaba * caust * 0.20 * uIntensity;

  // Soft top light
  col += alaba * smoothstep(0.55, -0.25, p.y) * 0.05;

  // Vignette
  float vig = smoothstep(1.35, 0.4, length(p));
  col *= mix(0.62, 1.0, vig);

  // Film grain
  col += (hash21(uv * res + fract(t) * 100.0) - 0.5) * 0.024;

  gl_FragColor = vec4(col, 1.0);
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("[liquid-glass] shader error:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

/**
 * Persistent full-screen liquid-glass scenery.
 *
 * Performance strategy:
 *  - fullscreen triangle (2 draw calls worth of geometry, single draw)
 *  - DPR capped at 1.5, then an adaptive governor scales the internal
 *    render resolution down (to 55%) if the frame-time EMA climbs above
 *    26ms and back up when it drops below 13ms
 *  - rAF paused while the tab is hidden
 *  - mouse position is lerped, never written per event
 *  - `prefers-reduced-motion` renders a single static frame
 *  - scene intensity is lerped toward `scene.target`, letting the
 *    Gateway → Site route change morph the same canvas with zero blank
 */
export function LiquidGlassCanvas({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const gl = (canvas.getContext("webgl2", {
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      powerPreference: "high-performance",
    }) ||
      canvas.getContext("webgl", {
        antialias: false,
        alpha: false,
        depth: false,
        stencil: false,
        powerPreference: "high-performance",
      })) as WebGLRenderingContext | null;

    if (!gl) return;

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("[liquid-glass] link error:", gl.getProgramInfoLog(program));
      return;
    }
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(program, "uResolution");
    const uTime = gl.getUniformLocation(program, "uTime");
    const uMouse = gl.getUniformLocation(program, "uMouse");
    const uIntensity = gl.getUniformLocation(program, "uIntensity");

    const dprCap = Math.min(window.devicePixelRatio || 1, 1.5);
    let renderScale = 1;
    let w = 0;
    let h = 0;

    const resize = () => {
      w = Math.max(1, Math.floor(window.innerWidth * dprCap * renderScale));
      h = Math.max(1, Math.floor(window.innerHeight * dprCap * renderScale));
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    };
    resize();
    window.addEventListener("resize", resize);

    const mouseTarget = { x: 0, y: 0 };
    const mouse = { x: 0, y: 0 };
    const onPointer = (e: PointerEvent) => {
      mouseTarget.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseTarget.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", onPointer, { passive: true });

    let raf = 0;
    let running = false;
    let last = performance.now();
    let emaDt = 16;
    let frames = 0;
    const start = last;

    const render = (now: number) => {
      if (!running) return;
      raf = requestAnimationFrame(render);
      const dt = now - last;
      last = now;
      emaDt = emaDt * 0.95 + Math.min(dt, 100) * 0.05;
      frames++;

      // Adaptive quality governor – never let the scenery stutter.
      if (frames % 60 === 0) {
        if (emaDt > 26 && renderScale > 0.55) {
          renderScale = Math.max(0.55, renderScale - 0.15);
          resize();
        } else if (emaDt < 13 && renderScale < 1) {
          renderScale = Math.min(1, renderScale + 0.15);
          resize();
        }
      }

      mouse.x += (mouseTarget.x - mouse.x) * 0.035;
      mouse.y += (mouseTarget.y - mouse.y) * 0.035;
      scene.intensity += (scene.target - scene.intensity) * 0.02;

      gl.uniform2f(uRes, w, h);
      gl.uniform1f(uTime, (now - start) / 1000);
      gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.uniform1f(uIntensity, scene.intensity);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const drawStatic = () => {
      gl.uniform2f(uRes, w, h);
      gl.uniform1f(uTime, 64);
      gl.uniform2f(uMouse, 0, 0);
      gl.uniform1f(uIntensity, scene.target);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    if (reduced) {
      drawStatic();
    } else {
      running = true;
      raf = requestAnimationFrame(render);
    }

    const onVisibility = () => {
      if (document.hidden) {
        if (running) {
          running = false;
          cancelAnimationFrame(raf);
        }
      } else if (!reduced && !running) {
        running = true;
        last = performance.now();
        raf = requestAnimationFrame(render);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("visibilitychange", onVisibility);
      if (buffer) gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
