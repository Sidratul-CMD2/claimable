"use client";

/**
 * Orb — adapted from the React Bits "Orb" reference (docs/Design Direction.pdf pp. 1–9).
 *
 * Adaptations (docs/DESIGN_SYSTEM.md): purely decorative and `pointer-events: none` so it can
 * never intercept search or navigation (hover still tracks the pointer via window events); no
 * click pulse; a static CSS fallback is rendered on the server, under reduced motion and when
 * WebGL2 is unavailable; animation pauses when offscreen or the tab is hidden; GL resources are
 * released on unmount. Defaults and hover behaviour match the reference.
 */
import { useEffect, useRef, useState } from "react";

const INTRO_SECONDS = 1.1;

const VERTEX = `#version 300 es
in vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision highp float;
uniform vec2 uResolution;
uniform float uTime;
uniform float uRotation;
uniform vec2 uReach;
uniform float uNear;
uniform float uAwake;
uniform vec3 uBackground;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform float uScale;
uniform float uWobble;
uniform float uGlow;
uniform float uBleed;
uniform float uHighlight;
uniform float uSwirl;
uniform float uOrbit;
uniform vec2 uEcho;
uniform float uReveal;
uniform float uOpacity;
uniform float uTrail;
out vec4 outColor;

vec3 hash33(vec3 p3) {
  p3 = fract(p3 * vec3(0.1031, 0.11369, 0.13787));
  p3 += dot(p3, p3.yxz + 19.19);
  return -1.0 + 2.0 * fract(vec3(p3.x + p3.y, p3.x + p3.z, p3.y + p3.z) * p3.zyx);
}
float snoise3(vec3 p) {
  const float K1 = 0.333333333;
  const float K2 = 0.166666667;
  vec3 i = floor(p + (p.x + p.y + p.z) * K1);
  vec3 d0 = p - (i - (i.x + i.y + i.z) * K2);
  vec3 e = step(vec3(0.0), d0 - d0.yzx);
  vec3 i1 = e * (1.0 - e.zxy);
  vec3 i2 = 1.0 - e.zxy * (1.0 - e);
  vec3 d1 = d0 - (i1 - K2);
  vec3 d2 = d0 - (i2 - K1);
  vec3 d3 = d0 - 0.5;
  vec4 h = max(0.6 - vec4(dot(d0, d0), dot(d1, d1), dot(d2, d2), dot(d3, d3)), 0.0);
  vec4 n = h * h * h * h * vec4(dot(d0, hash33(i)), dot(d1, hash33(i + i1)), dot(d2, hash33(i + i2)), dot(d3, hash33(i + 1.0)));
  return dot(vec4(31.316), n);
}
float light1(float intensity, float attenuation, float dist) { return intensity / (1.0 + dist * attenuation); }
float light2(float intensity, float attenuation, float dist) { return intensity / (1.0 + dist * dist * attenuation); }

vec4 draw(vec2 uv) {
  float rawLen = length(uv);
  vec2 dir = rawLen > 0.0001 ? uv / rawLen : vec2(1.0, 0.0);
  float reachAmount = length(uReach);
  vec2 reachDir = reachAmount > 0.00001 ? uReach / reachAmount : vec2(1.0, 0.0);
  float facing = exp((dot(dir, reachDir) - 1.0) * 3.2);
  float len = max(rawLen - reachAmount * facing * smoothstep(0.25, 0.65, rawLen), 0.0);
  uv = dir * len;
  float ang = atan(dir.y, dir.x);
  float invLen = len > 0.0 ? 1.0 / len : 0.0;
  float near = facing * uNear;
  float bgLuminance = dot(uBackground, vec3(0.299, 0.587, 0.114));
  float n0 = snoise3(vec3(uv * 0.65, uTime * 0.5)) * 0.5 + 0.5;
  float r0 = mix(0.8 - 0.04 * uWobble, 0.8 + 0.04 * uWobble, n0);
  float d0 = distance(uv, (r0 * invLen) * uv);
  float v0 = light1(1.0, 10.0 / uGlow, d0);
  v0 *= smoothstep(r0 * 1.05, r0, len);
  float reach = max(uBleed, 0.04);
  float innerFade = smoothstep(r0 * (1.0 - 0.2 * reach), r0 * (1.0 - 0.05 * reach), len);
  v0 *= mix(innerFade, 1.0, bgLuminance * 0.7 * min(uBleed, 1.0));
  float body = smoothstep(0.8 - 0.2 * reach, 0.8, len);
  float cl = cos(ang + uSwirl) * 0.5 + 0.5;
  vec2 pos = vec2(cos(uOrbit), sin(uOrbit)) * r0;
  float d = distance(uv, pos);
  vec2 head = vec2(cos(uOrbit), sin(uOrbit));
  float lag = atan(head.x * dir.y - head.y * dir.x, dot(dir, head));
  float trail = uTrail > 0.0 ? smoothstep(0.0, 0.35, lag) * exp(-max(lag, 0.0) * 2.6 / uTrail) : 0.0;
  float v1 = (light2(1.5, 5.0, d) + trail * 0.6) * uHighlight;
  v1 *= light1(1.0, 50.0, d0);
  float band = v0 * smoothstep(1.0, mix(0.6, 1.0, n0 * 0.5), len) * body;
  float heat = pow(clamp(band / 0.82, 0.0, 1.0), 3.0);
  float bloom = light2(1.0, 160.0 / uGlow, max(len - r0, 0.0)) * smoothstep(0.4, 0.0, len - r0) * step(r0, len);
  float v2 = smoothstep(1.0, mix(0.6, 1.0, n0 * 0.5), len);
  float v3 = body;
  vec3 colBase = mix(uColor1, uColor2, cl);
  float fadeAmount = mix(1.0, 0.1, bgLuminance);
  float echoD = abs(len - r0 - uEcho.x);
  float echo = light1(1.0, 60.0, echoD) * smoothstep(0.12, 0.0, echoD) * uEcho.y;
  vec3 darkCol = mix(uColor3, colBase, v0);
  darkCol = (darkCol + v1) * v2 * v3 * (1.0 + uAwake + near * 0.35) + mix(colBase, vec3(1.0), 0.25) * heat * (0.28 + near * 0.3);
  darkCol = clamp(darkCol + colBase * (bloom * 0.1 + echo), 0.0, 1.0);
  vec3 lightCol = (colBase + v1) * mix(1.0, v2 * v3, fadeAmount);
  lightCol = mix(uBackground, lightCol, clamp(v0 + echo, 0.0, 1.0));
  lightCol = mix(lightCol, colBase, clamp(v0, 0.0, 1.0) * clamp(near * 0.4 + uAwake, 0.0, 0.6));
  lightCol = clamp(mix(lightCol, vec3(1.0), clamp(v1 * 0.35, 0.0, 0.6)), 0.0, 1.0);
  vec3 finalCol = mix(darkCol, lightCol, bgLuminance);
  float alpha = max(max(finalCol.r, finalCol.g), finalCol.b);
  return vec4(finalCol / (alpha + 1e-5), alpha);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / min(uResolution.x, uResolution.y) * 2.0;
  uv *= uScale;
  float s = sin(uRotation);
  float c = cos(uRotation);
  uv = vec2(c * uv.x - s * uv.y, s * uv.x + c * uv.y);
  vec4 col = draw(uv);
  float dither = (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
  float alpha = clamp(col.a * uReveal * uOpacity + dither, 0.0, 1.0);
  outColor = vec4(col.rgb * alpha * alpha, alpha);
}`;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [0, 0, 0];
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  gl.deleteShader(shader);
  return null;
}

function link(gl: WebGL2RenderingContext) {
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.bindAttribLocation(program, 0, "aPosition");
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  const uniforms: Record<string, WebGLUniformLocation | null> = {};
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number;
  for (let i = 0; i < count; i++) {
    const info = gl.getActiveUniform(program, i);
    if (info) uniforms[info.name] = gl.getUniformLocation(program, info.name);
  }
  return { program, uniforms };
}

export interface OrbProps {
  colors?: [string, string, string];
  backgroundColor?: string;
  size?: number;
  glow?: number;
  bleed?: number;
  wobble?: number;
  highlight?: number;
  trail?: number;
  speed?: number;
  hoverIntensity?: number;
  /** Slowly turns the orb while the pointer is over it. */
  rotateOnHover?: boolean;
  /** The orbiting light swings toward the pointer while it is over the orb. */
  followCursor?: boolean;
  opacity?: number;
  className?: string;
}

export default function Orb({
  colors = ["#9c43fe", "#4cc2e9", "#101499"],
  backgroundColor = "#09090b",
  size = 1,
  glow = 1,
  bleed = 1,
  wobble = 1,
  highlight = 1,
  trail = 1,
  speed = 1,
  hoverIntensity = 1,
  rotateOnHover = true,
  followCursor = true,
  opacity = 1,
  /** Include a position utility (e.g. "absolute …"); defaults to relative. */
  className = "relative",
}: OrbProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState(false);
  const settings = { colors, backgroundColor, size, glow, bleed, wobble, highlight, trail, speed, hoverIntensity, rotateOnHover, followCursor, opacity };
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (reduce) return; // static CSS fallback stays visible
    // A fresh canvas per mount: cleanup calls loseContext(), and a React-managed canvas would
    // hand that lost context back on a remount (Strict Mode, Fast Refresh).
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.className = "absolute inset-0 h-full w-full";
    container.appendChild(canvas);
    const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
    if (!gl) {
      canvas.remove();
      return;
    }
    const linked = link(gl);
    if (!linked) {
      canvas.remove();
      return;
    }
    const u = linked.uniforms;
    const buffer = gl.createBuffer();
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const view = { width: 1, height: 1 };
    const pointer = { x: 0, y: 0, inside: false };
    const state = { time: 0, swirl: 0, orbit: 0, rotation: 0, hover: 0, near: 0, reachX: 0, reachY: 0, vx: 0, vy: 0, kick: 2.5, reveal: 0 };
    let raf = 0;
    let last = 0;
    let visible = true;

    const toOrb = (x: number, y: number): [number, number] => {
      const side = Math.min(view.width, view.height);
      const scale = 1 / settingsRef.current.size;
      const ux = ((x - view.width / 2) / side) * 2 * scale;
      const uy = ((view.height / 2 - y) / side) * 2 * scale;
      const s = Math.sin(state.rotation);
      const c = Math.cos(state.rotation);
      return [c * ux - s * uy, s * ux + c * uy];
    };

    const render = () => {
      const s = settingsRef.current;
      const reveal = state.reveal;
      const back = reveal - 1;
      const grow = 1 + 2.2 * back * back * back + 1.2 * back * back;
      const r = Math.min(1, reveal / 0.55);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(linked.program);
      gl.bindVertexArray(vao);
      gl.uniform2f(u.uResolution, canvas.width, canvas.height);
      gl.uniform1f(u.uTime, state.time);
      gl.uniform2f(u.uReach, state.reachX, state.reachY);
      gl.uniform1f(u.uNear, state.near);
      gl.uniform1f(u.uAwake, state.hover * s.hoverIntensity * 0.18);
      gl.uniform1f(u.uRotation, state.rotation);
      gl.uniform3fv(u.uBackground, hexToRgb(s.backgroundColor));
      gl.uniform3fv(u.uColor1, hexToRgb(s.colors[0]));
      gl.uniform3fv(u.uColor2, hexToRgb(s.colors[1]));
      gl.uniform3fv(u.uColor3, hexToRgb(s.colors[2]));
      gl.uniform1f(u.uScale, 1 / (s.size * (0.62 + 0.38 * grow)));
      gl.uniform1f(u.uWobble, s.wobble);
      gl.uniform1f(u.uGlow, clamp(s.glow, 0.1, 5));
      gl.uniform1f(u.uBleed, clamp(s.bleed, 0, 4));
      gl.uniform1f(u.uHighlight, s.highlight);
      gl.uniform2f(u.uEcho, 0.55, 0);
      gl.uniform1f(u.uSwirl, state.swirl);
      gl.uniform1f(u.uOrbit, state.orbit);
      gl.uniform1f(u.uReveal, r * r * (3 - 2 * r));
      gl.uniform1f(u.uOpacity, clamp(s.opacity, 0, 1));
      gl.uniform1f(u.uTrail, s.trail);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const frame = (now: number) => {
      raf = 0;
      if (!visible || document.hidden || gl.isContextLost()) return;
      const s = settingsRef.current;
      const dt = last ? clamp((now - last) / 1000, 0.0005, 0.05) : 1 / 60;
      last = now;
      const [px, py] = toOrb(pointer.x, pointer.y);
      const distance = Math.hypot(px, py);
      const region = pointer.inside ? clamp((1.45 - distance) / 0.4, 0, 1) : 0;
      const zone = region * region * (3 - 2 * region);
      const aimed = zone * clamp((distance - 0.15) / 0.45, 0, 1);
      state.hover += (zone - state.hover) * (1 - Math.exp(-dt / 0.16));
      const reach = 0.075 * s.hoverIntensity * aimed;
      const goalX = distance > 0.0001 ? (px / distance) * reach : 0;
      const goalY = distance > 0.0001 ? (py / distance) * reach : 0;
      state.vx += (70 * (goalX - state.reachX) - 7 * state.vx) * dt;
      state.vy += (70 * (goalY - state.reachY) - 7 * state.vy) * dt;
      state.reachX += state.vx * dt;
      state.reachY += state.vy * dt;
      state.near += (aimed * s.hoverIntensity - state.near) * (1 - Math.exp(-dt / 0.12));
      const step = dt * s.speed;
      state.time += step;
      state.swirl += step * 2 * (1 + state.kick);
      if (s.rotateOnHover) state.rotation += dt * 0.3 * state.hover;
      if (s.followCursor && zone > 0.5) {
        const aim = Math.atan2(py, px);
        state.orbit += Math.atan2(Math.sin(aim - state.orbit), Math.cos(aim - state.orbit)) * (1 - Math.exp(-dt * 6));
      } else {
        state.orbit -= step;
      }
      state.orbit = Math.atan2(Math.sin(state.orbit), Math.cos(state.orbit));
      state.kick *= Math.exp(-dt * 2.5);
      if (state.reveal < 1) state.reveal = Math.min(1, state.reveal + dt / INTRO_SECONDS);
      render();
      raf = requestAnimationFrame(frame);
    };
    const wake = () => {
      if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame);
    };
    const resize = () => {
      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      view.width = width;
      view.height = height;
      canvas.width = Math.max(1, Math.round(width * ratio));
      canvas.height = Math.max(1, Math.round(height * ratio));
      render();
      wake();
    };
    const onPointerMove = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      pointer.inside = pointer.x >= 0 && pointer.y >= 0 && pointer.x <= rect.width && pointer.y <= rect.height;
      wake();
    };
    const onVisibility = () => {
      last = 0;
      wake();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    const intersection = new IntersectionObserver((entries) => {
      visible = entries.some((e) => e.isIntersecting);
      if (visible) {
        last = 0;
        wake();
      }
    });
    intersection.observe(container);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    // If the GPU drops the context, fall back to the static ring instead of a blank canvas.
    let lost = false;
    const onContextLost = (event: Event) => {
      event.preventDefault();
      lost = true;
      cancelAnimationFrame(raf);
      raf = 0;
      setLive(false);
    };
    canvas.addEventListener("webglcontextlost", onContextLost);
    resize();
    if (!gl.isContextLost()) setLive(true);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      intersection.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      setLive(false);
      if (lost) {
        canvas.remove();
        return;
      }
      gl.deleteProgram(linked.program);
      gl.deleteBuffer(buffer);
      gl.deleteVertexArray(vao);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      canvas.remove();
    };
  }, []);

  return (
    <div ref={containerRef} aria-hidden="true" className={`pointer-events-none select-none ${className}`}>
      <div className={`orb-fallback absolute inset-[8%] transition-opacity duration-700 ${live ? "opacity-0" : "opacity-100"}`} />
    </div>
  );
}
