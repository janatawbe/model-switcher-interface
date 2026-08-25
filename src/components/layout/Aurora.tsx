// Renders the animated WebGL2 background, blending model colors on hover/selection.
import { useEffect, useRef, useState } from "react";
import { MODELS, getModelIndex } from "../ui/models";
import { AURORA_FRAGMENT_SHADER, AURORA_VERTEX_SHADER } from "./auroraShaders";

type AuroraProps = {
  activeModel: string | null;
  previewModel: string | null;
};

// Governs how the model-color weights (and preview softness) ease toward
// their target -- tuned so the transition visually settles in roughly
// 600-1200ms rather than reading as an instant swap.
const MIX_TAU = 0.42;
const ENERGY_TAU = 0.3;
const MOUSE_TAU = 0.12;
const MAX_DPR = 1.75;
// The field is soft and heavily blurred by nature, so rendering at a lower
// backing resolution and letting the GPU upscale it is visually
// indistinguishable from full resolution but substantially cheaper per pixel.
const RENDER_SCALE = 0.65;

function compileShader(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("Aurora shader compile error:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function Aurora({ activeModel, previewModel }: AuroraProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [useFallback, setUseFallback] = useState(false);

  const stateRef = useRef({ activeModel, previewModel });
  const wakeRef = useRef<() => void>(() => {});

  useEffect(() => {
    stateRef.current = { activeModel, previewModel };
    wakeRef.current();
  }, [activeModel, previewModel]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const gl = canvas.getContext("webgl2", {
      antialias: false,
      alpha: false,
      powerPreference: "low-power",
    });
    if (!gl) {
      setUseFallback(true);
      return;
    }

    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, AURORA_VERTEX_SHADER);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, AURORA_FRAGMENT_SHADER);
    if (!vertexShader || !fragmentShader) {
      setUseFallback(true);
      return;
    }

    const program = gl.createProgram();
    if (!program) {
      setUseFallback(true);
      return;
    }
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Aurora program link error:", gl.getProgramInfoLog(program));
      setUseFallback(true);
      return;
    }

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const positionLoc = gl.getAttribLocation(program, "a_position");

    const uniforms = {
      resolution: gl.getUniformLocation(program, "u_resolution"),
      time: gl.getUniformLocation(program, "u_time"),
      energy: gl.getUniformLocation(program, "u_energy"),
      weights: gl.getUniformLocation(program, "u_weights"),
      mouse: gl.getUniformLocation(program, "u_mouse"),
      mouseActive: gl.getUniformLocation(program, "u_mouseActive"),
      previewSoftness: gl.getUniformLocation(program, "u_previewSoftness"),
      colorPrimary0: gl.getUniformLocation(program, "u_colorPrimary0"),
      colorSecondary0: gl.getUniformLocation(program, "u_colorSecondary0"),
      colorHighlight0: gl.getUniformLocation(program, "u_colorHighlight0"),
      colorPrimary1: gl.getUniformLocation(program, "u_colorPrimary1"),
      colorSecondary1: gl.getUniformLocation(program, "u_colorSecondary1"),
      colorHighlight1: gl.getUniformLocation(program, "u_colorHighlight1"),
      colorPrimary2: gl.getUniformLocation(program, "u_colorPrimary2"),
      colorSecondary2: gl.getUniformLocation(program, "u_colorSecondary2"),
      colorHighlight2: gl.getUniformLocation(program, "u_colorHighlight2"),
    };

    const palettes = MODELS.map((model) => model.aurora);
    const idleWeights = palettes.map((palette) => palette.idleWeight ?? 1);
    const idleWeightSum = idleWeights.reduce((sum, weight) => sum + weight, 0);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR) * RENDER_SCALE;
    let width = 0;
    let height = 0;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      width = Math.max(1, Math.floor(rect.width * dpr));
      height = Math.max(1, Math.floor(rect.height * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
    };
    resize();

    // Changing canvas.width/height (inside resize()) clears the drawing
    // buffer per the canvas spec -- fine while the render loop is running,
    // since the next frame repaints it, but the loop deliberately stops
    // itself once the animation settles (see the `idle` convergence check
    // below) to avoid redrawing an unchanging frame forever. Without also
    // waking it here, a resize after that point clears the canvas and
    // nothing ever redraws it. wakeRef is the same restart path prop
    // changes already use, so this settles right back to idle after one
    // fresh frame at the new size.
    const resizeObserver = new ResizeObserver(() => {
      resize();
      wakeRef.current();
    });
    resizeObserver.observe(container);

    const targetMouse = { x: 0, y: 0 };
    const currentMouse = { x: 0, y: 0 };

    const handlePointerMove = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const nx = (event.clientX - rect.left) / rect.width - 0.5;
      const ny = 1.0 - (event.clientY - rect.top) / rect.height - 0.5;
      const aspect = rect.width / rect.height;
      targetMouse.x = nx * aspect;
      targetMouse.y = ny;
    };
    window.addEventListener("pointermove", handlePointerMove, { passive: true });

    let currentEnergy = 1;
    const currentWeights: number[] = idleWeights.map((weight) => weight / idleWeightSum);
    let currentMouseActive = 0;
    let currentPreviewSoftness = 0;
    let effectiveTime = 0;
    let lastTimestamp = performance.now();
    let rafId = 0;
    let idle = false;

    const render = (timestamp: number) => {
      const dt = Math.min(0.05, Math.max(0, (timestamp - lastTimestamp) / 1000));
      lastTimestamp = timestamp;

      const { activeModel: active, previewModel: preview } = stateRef.current;
      // Whether a model is settled (lavender/cyan/orange only, no motion)
      // or the interface is still in the multi-model exploration state is
      // driven purely by whether a model has been chosen -- not by whether
      // a conversation has started yet.
      const exploring = active === null;

      let energyTarget = exploring || preview ? 1 : 0;
      if (reducedMotion) energyTarget = Math.min(energyTarget, 0.12);

      // Hovering a model previews it as a pure, monochromatic atmosphere --
      // same one-hot target as an actively selected model -- so the user
      // reads it as "this is that AI's personality," not a blend. Only the
      // balanced idle state (nothing hovered, nothing selected yet) mixes
      // all three, weighted by each palette's idleWeight to compensate for
      // palettes that are inherently quieter at equal numeric share.
      const weightTargets: number[] = new Array(MODELS.length).fill(0);
      if (preview) {
        weightTargets[getModelIndex(preview)] = 1;
      } else if (exploring) {
        for (let i = 0; i < MODELS.length; i++) {
          weightTargets[i] = idleWeights[i] / idleWeightSum;
        }
      } else {
        weightTargets[getModelIndex(active)] = 1;
      }

      const mouseActiveTarget = exploring || preview ? 1 : 0;
      // The balanced idle field IS three hover atmospheres composed
      // together, so it shares the exact same softened intensity as a
      // single hovered preview -- both are "no model committed yet." Only
      // an actively selected model steps up to full vibrancy. Because
      // softness no longer changes between idle and hover, moving into or
      // out of a preview only shifts which model dominates, never the
      // underlying color character.
      const previewSoftnessTarget = exploring ? 1 : 0;

      const kMix = 1 - Math.exp(-dt / MIX_TAU);
      const kEnergy = 1 - Math.exp(-dt / ENERGY_TAU);
      const kMouse = 1 - Math.exp(-dt / MOUSE_TAU);

      currentEnergy += (energyTarget - currentEnergy) * kEnergy;
      let maxWeightDelta = 0;
      for (let i = 0; i < MODELS.length; i++) {
        currentWeights[i] += (weightTargets[i] - currentWeights[i]) * kMix;
        maxWeightDelta = Math.max(maxWeightDelta, Math.abs(weightTargets[i] - currentWeights[i]));
      }
      currentPreviewSoftness += (previewSoftnessTarget - currentPreviewSoftness) * kMix;
      currentMouseActive += (mouseActiveTarget - currentMouseActive) * kMouse;
      currentMouse.x += (targetMouse.x - currentMouse.x) * kMouse;
      currentMouse.y += (targetMouse.y - currentMouse.y) * kMouse;

      effectiveTime += dt * (0.15 + 0.85 * Math.max(0, currentEnergy));

      gl.viewport(0, 0, width, height);
      gl.useProgram(program);
      gl.uniform2f(uniforms.resolution, width, height);
      gl.uniform1f(uniforms.time, effectiveTime);
      gl.uniform1f(uniforms.energy, currentEnergy);
      gl.uniform3f(uniforms.weights, currentWeights[0], currentWeights[1], currentWeights[2]);
      gl.uniform2f(uniforms.mouse, currentMouse.x, currentMouse.y);
      gl.uniform1f(uniforms.mouseActive, currentMouseActive);
      gl.uniform1f(uniforms.previewSoftness, currentPreviewSoftness);
      gl.uniform3f(uniforms.colorPrimary0, ...palettes[0].primary);
      gl.uniform3f(uniforms.colorSecondary0, ...palettes[0].secondary);
      gl.uniform3f(uniforms.colorHighlight0, ...palettes[0].highlight);
      gl.uniform3f(uniforms.colorPrimary1, ...palettes[1].primary);
      gl.uniform3f(uniforms.colorSecondary1, ...palettes[1].secondary);
      gl.uniform3f(uniforms.colorHighlight1, ...palettes[1].highlight);
      gl.uniform3f(uniforms.colorPrimary2, ...palettes[2].primary);
      gl.uniform3f(uniforms.colorSecondary2, ...palettes[2].secondary);
      gl.uniform3f(uniforms.colorHighlight2, ...palettes[2].highlight);

      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.enableVertexAttribArray(positionLoc);
      gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      const converged =
        Math.abs(energyTarget - currentEnergy) < 0.002 &&
        maxWeightDelta < 0.002 &&
        Math.abs(mouseActiveTarget - currentMouseActive) < 0.002 &&
        Math.abs(previewSoftnessTarget - currentPreviewSoftness) < 0.002 &&
        currentEnergy < 0.01;

      if (converged && !exploring && !preview) {
        idle = true;
        return;
      }

      rafId = requestAnimationFrame(render);
    };

    wakeRef.current = () => {
      if (idle) {
        idle = false;
        lastTimestamp = performance.now();
        rafId = requestAnimationFrame(render);
      }
    };

    rafId = requestAnimationFrame(render);

    const handleContextLost = (event: Event) => {
      event.preventDefault();
      cancelAnimationFrame(rafId);
      setUseFallback(true);
    };
    canvas.addEventListener("webglcontextlost", handleContextLost);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      window.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      gl.deleteBuffer(positionBuffer);
    };
  }, []);

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0 overflow-hidden">
      {useFallback ? (
        <div
          className="h-full w-full"
          style={{
            background:
              "radial-gradient(46% 42% at 24% 30%, rgba(183,148,246,0.16), transparent 65%)," +
              "radial-gradient(46% 42% at 76% 34%, rgba(34,211,238,0.16), transparent 65%)," +
              "radial-gradient(46% 42% at 50% 78%, rgba(224,138,86,0.14), transparent 65%)," +
              "#08090d",
          }}
        />
      ) : (
        <canvas ref={canvasRef} className="h-full w-full" />
      )}
    </div>
  );
}
