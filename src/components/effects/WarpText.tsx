"use client";

/**
 * WarpText — adapted from the React Bits "WarpText" reference (docs/Design Direction.pdf pp. 36–47).
 *
 * Adaptations: raw WebGL2 instead of the `ogl` dependency; sized for a compact header instead
 * of the 320px demo; real text is server-rendered and remains the accessible name and the
 * static fallback (reduced motion, no WebGL, before hydration); the canvas is aria-hidden;
 * no click ripple (the wordmark is a home link); paused offscreen and when the tab is hidden.
 */
import { useEffect, useRef, useState } from "react";

const INTRO_MS = 1400;

const VERTEX = `#version 300 es
in vec2 position;
in vec2 uv;
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uTextTexture;
uniform vec2 uResolution;
uniform vec2 uPointer;
uniform float uPointerActive;
uniform float uTime;
uniform float uWarpStrength;
uniform float uWarpScale;
uniform float uSpeed;
uniform float uPointerInfluence;
uniform float uPointerStrength;
uniform float uRefraction;
uniform float uChromatic;
uniform float uRipple;
uniform float uMotion;
uniform float uIntro;
uniform float uReveal;
uniform float uBackdrop;
in vec2 vUv;
out vec4 fragColor;
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i); float b = hash(i + vec2(1.0, 0.0)); float c = hash(i + vec2(0.0, 1.0)); float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p) { float v = 0.0; float a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.02; a *= 0.5; } return v; }
vec4 sampleText(vec2 uv) {
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec4(0.0);
  return texture(uTextTexture, uv);
}
void main() {
  vec2 uv = vUv;
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  float time = uTime * uSpeed;
  float scale = max(uWarpScale, 0.001);
  vec2 drift = vec2(time * 0.055, -time * 0.045);
  float n1 = fbm(uv * scale * 3.1 + drift);
  float n2 = fbm((uv + 19.17) * scale * 3.4 - drift.yx);
  vec2 ambient = (vec2(n1, n2) - 0.5) * (uWarpStrength * 0.045 * uMotion + uIntro * 0.18);
  vec2 pointerDelta = uv - uPointer;
  vec2 aspectDelta = vec2(pointerDelta.x * aspect, pointerDelta.y);
  float dist = length(aspectDelta);
  float radius = max(uPointerInfluence, 0.001);
  float t = clamp(dist / radius, 0.0, 1.0);
  float lens = smoothstep(radius, 0.0, dist) * uPointerActive;
  float bulge = t * (1.0 - t) * (1.0 - t) * 6.75 * uPointerActive;
  vec2 dir = dist > 0.0001 ? vec2(aspectDelta.x / aspect, aspectDelta.y) / dist : vec2(0.0);
  float rippleWave = sin(dist * 28.0 - time * 4.2) * 0.5 + 0.5;
  float rippleRing = (rippleWave - 0.5) * uRipple;
  vec2 pointerWarp = dir * rippleRing * bulge * uPointerStrength * 0.016;
  pointerWarp -= dir * bulge * uPointerStrength * 0.045;
  vec2 bend = pointerWarp;
  vec2 rest = uv + ambient;
  vec2 splitDir = ambient + bend;
  float splitLen = length(splitDir);
  splitDir = splitLen > 0.00001 ? splitDir / splitLen : vec2(0.7071, 0.7071);
  vec2 split = splitDir * uRefraction * 0.16 * (0.35 + lens * 1.65 + uIntro * 3.0);
  float dispersion = uChromatic * 0.5;
  vec3 ink = vec3(0.0); vec3 cover = vec3(0.0); vec3 weight = vec3(0.0);
  for (int i = 0; i < 7; i++) {
    float k = 1.0 - float(i) / 3.0;
    vec4 tap = sampleText(rest + bend * (1.0 + dispersion * k) + split * k);
    vec3 band = vec3(max(k, 0.0), 1.0 - abs(k), max(-k, 0.0));
    ink += tap.rgb * band; cover += tap.a * band; weight += band;
  }
  ink /= weight; cover /= weight;
  float a = max(max(cover.r, cover.g), cover.b);
  vec3 color = ink + (a - cover) * uBackdrop;
  color = min(color + lens * cover.g * 0.055, vec3(a));
  fragColor = vec4(color, a) * uReveal;
}`;

const smooth = (v: number) => v * v * (3 - 2 * v);

export interface WarpTextProps {
  text: string;
  className?: string;
  /** Classes for the static text (font, size, tracking). The canvas rasterises the same styles. */
  textClassName?: string;
  warpStrength?: number;
  warpScale?: number;
  speed?: number;
  pointerInfluence?: number;
  pointerStrength?: number;
  refraction?: number;
  chromatic?: number;
  idleDrift?: number;
}

export default function WarpText({
  text,
  className = "",
  textClassName = "",
  warpStrength = 0.08,
  warpScale = 1.7,
  speed = 0.5,
  pointerInfluence = 0.42,
  pointerStrength = 0.38,
  refraction = 0.018,
  chromatic = 0.3,
  idleDrift = 0.15,
}: WarpTextProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [live, setLive] = useState(false);
  const propsRef = useRef({ warpStrength, warpScale, speed, pointerInfluence, pointerStrength, refraction, chromatic, idleDrift });
  propsRef.current = { warpStrength, warpScale, speed, pointerInfluence, pointerStrength, refraction, chromatic, idleDrift };

  useEffect(() => {
    const container = containerRef.current;
    const textEl = textRef.current;
    if (!container || !textEl) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: true });
    if (!gl) return;
    const compile = (type: number, source: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, source);
      gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    };
    const vs = compile(gl.VERTEX_SHADER, VERTEX);
    const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT);
    if (!vs || !fs) return;
    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.bindAttribLocation(program, 0, "position");
    gl.bindAttribLocation(program, 1, "uv");
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    const loc = (name: string) => gl.getUniformLocation(program, name);
    const U = Object.fromEntries(
      [
        "uTextTexture", "uResolution", "uPointer", "uPointerActive", "uTime", "uWarpStrength", "uWarpScale", "uSpeed",
        "uPointerInfluence", "uPointerStrength", "uRefraction", "uChromatic", "uRipple", "uMotion", "uIntro", "uReveal", "uBackdrop",
      ].map((n) => [n, loc(n)]),
    );

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const uvBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 2, 0, 0, 2]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
    const texture = gl.createTexture();

    Object.assign(canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%", display: "block", pointerEvents: "auto" });
    canvas.setAttribute("aria-hidden", "true");
    container.appendChild(canvas);

    let disposed = false;
    let raf = 0;
    let visible = true;
    let textReady = false;
    let introProgress = 0;
    let lastFrame = 0;
    const start = performance.now();
    const pointer = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, active: 0, engaged: false };

    const rasterize = async () => {
      await document.fonts?.ready.catch(() => undefined);
      if (disposed) return;
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      const style = getComputedStyle(textEl);
      const raster = document.createElement("canvas");
      raster.width = canvas.width;
      raster.height = canvas.height;
      const ctx = raster.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = style.color;
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const spacing = style.letterSpacing === "normal" ? 0 : parseFloat(style.letterSpacing) || 0;
      const chars = Array.from(text);
      const width = chars.reduce((w, c) => w + ctx.measureText(c).width, 0) + spacing * Math.max(0, chars.length - 1);
      // Align the raster with the static text so the swap is seamless.
      const textRect = textEl.getBoundingClientRect();
      let cursor = textRect.left - rect.left + (textRect.width - width) / 2;
      const y = textRect.top - rect.top + textRect.height / 2;
      for (const c of chars) {
        ctx.fillText(c, cursor, y);
        cursor += ctx.measureText(c).width + spacing;
      }
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, raster);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const [r, g, b] = (style.color.match(/\d+(\.\d+)?/g) ?? ["255", "255", "255"]).map(Number);
      gl.useProgram(program);
      gl.uniform1f(U.uBackdrop, (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.5 ? 1 : 0);
      textReady = true;
      if (!live) setLive(true);
    };

    const loop = (now: number) => {
      raf = 0;
      if (disposed || !visible || document.hidden) return;
      const p = propsRef.current;
      const elapsed = (now - start) / 1000;
      const delta = lastFrame ? Math.min(now - lastFrame, 50) : 16;
      lastFrame = now;
      if (textReady && introProgress < 1) introProgress = Math.min(1, introProgress + delta / INTRO_MS);
      const settle = 1 - introProgress;
      const drift = Math.min(Math.max(p.idleDrift, 0), 1);
      const idleX = 0.5 + Math.sin(elapsed * 0.33) * (0.08 + drift * 0.2);
      const idleY = 0.5 + Math.cos(elapsed * 0.27) * (0.06 + drift * 0.2);
      const follow = 1 - Math.exp(-delta / (pointer.engaged ? 130 : 470));
      pointer.x += ((pointer.engaged ? pointer.tx : idleX) - pointer.x) * follow;
      pointer.y += ((pointer.engaged ? pointer.ty : idleY) - pointer.y) * follow;
      pointer.active += ((pointer.engaged ? 1 : drift) - pointer.active) * (1 - Math.exp(-delta / 270));

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(program);
      gl.bindVertexArray(vao);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(U.uTextTexture, 0);
      gl.uniform2f(U.uResolution, canvas.width, canvas.height);
      gl.uniform2f(U.uPointer, pointer.x, pointer.y);
      gl.uniform1f(U.uPointerActive, pointer.active);
      gl.uniform1f(U.uTime, elapsed);
      gl.uniform1f(U.uWarpStrength, p.warpStrength);
      gl.uniform1f(U.uWarpScale, p.warpScale);
      gl.uniform1f(U.uSpeed, p.speed);
      gl.uniform1f(U.uPointerInfluence, p.pointerInfluence);
      gl.uniform1f(U.uPointerStrength, p.pointerStrength);
      gl.uniform1f(U.uRefraction, p.refraction);
      gl.uniform1f(U.uChromatic, p.chromatic);
      gl.uniform1f(U.uRipple, 1);
      gl.uniform1f(U.uMotion, 1);
      gl.uniform1f(U.uIntro, settle * settle * settle);
      gl.uniform1f(U.uReveal, textReady ? smooth(Math.min(1, introProgress / 0.45)) : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(loop);
    };
    const wake = () => {
      if (!raf && visible && !document.hidden && !disposed) raf = requestAnimationFrame(loop);
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const rect = canvas.getBoundingClientRect();
      pointer.tx = (e.clientX - rect.left) / rect.width;
      pointer.ty = 1 - (e.clientY - rect.top) / rect.height;
      pointer.engaged = true;
    };
    const onLeave = () => {
      pointer.engaged = false;
    };
    const onVisibility = () => {
      lastFrame = 0;
      wake();
    };
    const onLost = (e: Event) => {
      e.preventDefault();
      disposed = true;
      setLive(false);
    };
    const resizeObserver = new ResizeObserver(() => {
      void rasterize();
    });
    resizeObserver.observe(container);
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) wake();
    });
    io.observe(container);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("webglcontextlost", onLost);
    document.addEventListener("visibilitychange", onVisibility);
    void rasterize().then(wake);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      io.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("webglcontextlost", onLost);
      document.removeEventListener("visibilitychange", onVisibility);
      gl.deleteTexture(texture);
      gl.deleteBuffer(posBuf);
      gl.deleteBuffer(uvBuf);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(program);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      canvas.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <span ref={containerRef} className={`relative isolate inline-flex items-center justify-center ${className}`}>
      <span ref={textRef} className={`${textClassName} transition-opacity duration-300 ${live ? "opacity-0" : "opacity-100"}`}>
        {text}
      </span>
    </span>
  );
}
