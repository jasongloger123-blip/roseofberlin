"use client";

import { useEffect, useRef } from "react";

type PetalConfig = {
  asset: string;
  baseX: number;
  baseY: number;
  size: number;
  opacity: number;
  blur: number;
  depth: number;
  spring: number;
  damping: number;
  magnet: number;
  orbit: number;
  phase: number;
  rotation: number;
  rotationSpeed: number;
};

type PetalMotion = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationVelocity: number;
};

const PETALS: PetalConfig[] = [
  { asset: "/rose-petal-1.svg", baseX: 12, baseY: 24, size: 31, opacity: .68, blur: .3, depth: .72, spring: .018, damping: .91, magnet: .29, orbit: 25, phase: .2, rotation: -24, rotationSpeed: .15 },
  { asset: "/rose-petal-2.svg", baseX: 74, baseY: 17, size: 25, opacity: .74, blur: 0, depth: .9, spring: .022, damping: .9, magnet: .47, orbit: 18, phase: 1.1, rotation: 32, rotationSpeed: -.2 },
  { asset: "/rose-petal-3.svg", baseX: 88, baseY: 43, size: 38, opacity: .58, blur: .8, depth: .55, spring: .014, damping: .925, magnet: .2, orbit: 34, phase: 2.4, rotation: -8, rotationSpeed: .1 },
  { asset: "/rose-petal-1.svg", baseX: 18, baseY: 72, size: 22, opacity: .62, blur: 0, depth: 1.02, spring: .026, damping: .89, magnet: .54, orbit: 15, phase: 3.7, rotation: 48, rotationSpeed: -.24 },
  { asset: "/rose-petal-2.svg", baseX: 42, baseY: 13, size: 19, opacity: .55, blur: .4, depth: .64, spring: .016, damping: .92, magnet: .24, orbit: 28, phase: 4.5, rotation: 18, rotationSpeed: .13 },
  { asset: "/rose-petal-3.svg", baseX: 68, baseY: 68, size: 29, opacity: .7, blur: .2, depth: .84, spring: .021, damping: .9, magnet: .39, orbit: 22, phase: 5.4, rotation: -42, rotationSpeed: .19 },
  { asset: "/rose-petal-1.svg", baseX: 92, baseY: 79, size: 44, opacity: .42, blur: 1.5, depth: .42, spring: .011, damping: .94, magnet: .15, orbit: 40, phase: .8, rotation: 27, rotationSpeed: -.08 },
  { asset: "/rose-petal-2.svg", baseX: 33, baseY: 48, size: 27, opacity: .66, blur: 0, depth: 1.12, spring: .029, damping: .885, magnet: .58, orbit: 13, phase: 2, rotation: -15, rotationSpeed: .27 },
  { asset: "/rose-petal-3.svg", baseX: 55, baseY: 84, size: 24, opacity: .52, blur: .6, depth: .61, spring: .015, damping: .925, magnet: .25, orbit: 31, phase: 3.1, rotation: 52, rotationSpeed: -.12 },
  { asset: "/rose-petal-1.svg", baseX: 9, baseY: 91, size: 36, opacity: .45, blur: 1.1, depth: .48, spring: .012, damping: .935, magnet: .17, orbit: 37, phase: 4.2, rotation: -36, rotationSpeed: .09 },
  { asset: "/rose-petal-2.svg", baseX: 81, baseY: 93, size: 20, opacity: .65, blur: .1, depth: .96, spring: .024, damping: .895, magnet: .49, orbit: 17, phase: 5.8, rotation: 9, rotationSpeed: -.22 },
  { asset: "/rose-petal-3.svg", baseX: 51, baseY: 36, size: 33, opacity: .5, blur: .7, depth: .58, spring: .013, damping: .93, magnet: .19, orbit: 33, phase: 1.7, rotation: 39, rotationSpeed: .11 },
];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export default function RosePetalField() {
  const fieldRef = useRef<HTMLDivElement>(null);
  const petalRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const lightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const field = fieldRef.current;
    const host = field?.parentElement;
    if (!field || !host) return;

    const finePointer = window.matchMedia("(pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const dimensions = { width: host.clientWidth, height: host.clientHeight };
    const pointer = {
      x: dimensions.width * .5,
      y: dimensions.height * .5,
      smoothX: dimensions.width * .5,
      smoothY: dimensions.height * .5,
      velocityX: 0,
      velocityY: 0,
      lastX: dimensions.width * .5,
      lastY: dimensions.height * .5,
      lastTime: performance.now(),
      influence: 0,
      inside: false,
    };
    let rect = host.getBoundingClientRect();
    let frameId = 0;
    let previousTime = performance.now();
    let visible = true;
    let ready = false;

    const motions: PetalMotion[] = PETALS.map((petal) => ({
      x: dimensions.width * petal.baseX / 100,
      y: dimensions.height * petal.baseY / 100,
      vx: 0,
      vy: 0,
      rotation: petal.rotation,
      rotationVelocity: 0,
    }));

    const updateBounds = () => {
      rect = host.getBoundingClientRect();
      dimensions.width = rect.width;
      dimensions.height = rect.height;
    };

    const stop = () => {
      if (frameId) cancelAnimationFrame(frameId);
      frameId = 0;
    };

    const renderFrame = (time: number) => {
      if (!visible || document.hidden || reducedMotion.matches) {
        stop();
        return;
      }

      const elapsed = Math.min(32, time - previousTime || 16.67);
      const step = elapsed / 16.67;
      const seconds = time / 1000;
      previousTime = time;
      pointer.influence += ((pointer.inside && finePointer.matches ? 1 : 0) - pointer.influence) * (.035 * step);
      pointer.smoothX += (pointer.x - pointer.smoothX) * (.075 * step);
      pointer.smoothY += (pointer.y - pointer.smoothY) * (.075 * step);
      pointer.velocityX *= Math.pow(.91, step);
      pointer.velocityY *= Math.pow(.91, step);

      const activePetals = finePointer.matches ? PETALS.length : 4;
      for (let index = 0; index < activePetals; index += 1) {
        const config = PETALS[index];
        const motion = motions[index];
        const element = petalRefs.current[index];
        if (!element) continue;

        const idleX = dimensions.width * config.baseX / 100
          + Math.sin(seconds * (.16 + config.depth * .07) + config.phase) * (5 + config.depth * 4);
        const idleY = dimensions.height * config.baseY / 100
          + Math.cos(seconds * (.12 + config.depth * .05) + config.phase) * 5
          - Math.sin(seconds * .08 + config.phase) * (4 + config.depth * 3);
        const orbitAngle = seconds * (.32 + config.depth * .13) + config.phase;
        const orbitX = Math.cos(orbitAngle) * config.orbit;
        const orbitY = Math.sin(orbitAngle * .82) * config.orbit * .58;
        const interactionX = (pointer.smoothX - idleX) * config.magnet + orbitX + pointer.velocityX * config.depth * .32;
        const interactionY = (pointer.smoothY - idleY) * config.magnet + orbitY + pointer.velocityY * config.depth * .32;
        const targetX = idleX + interactionX * pointer.influence;
        const targetY = idleY + interactionY * pointer.influence;

        motion.vx += (targetX - motion.x) * config.spring * step;
        motion.vy += (targetY - motion.y) * config.spring * step;
        motion.vx *= Math.pow(config.damping, step);
        motion.vy *= Math.pow(config.damping, step);
        motion.x += motion.vx * step;
        motion.y += motion.vy * step;

        const targetRotation = config.rotation
          + Math.sin(seconds * .25 + config.phase) * 13
          + pointer.influence * (orbitX * .34 + pointer.velocityX * .04);
        motion.rotationVelocity += (targetRotation - motion.rotation) * .008 * step;
        motion.rotationVelocity *= Math.pow(.92, step);
        motion.rotation += (motion.rotationVelocity + config.rotationSpeed) * step;

        element.style.transform = `translate3d(${motion.x.toFixed(2)}px, ${motion.y.toFixed(2)}px, 0) rotate(${motion.rotation.toFixed(2)}deg)`;
      }

      const light = lightRef.current;
      if (light) {
        light.style.opacity = String(pointer.influence * .24);
        light.style.transform = `translate3d(${(pointer.smoothX - 150).toFixed(2)}px, ${(pointer.smoothY - 150).toFixed(2)}px, 0)`;
      }
      if (!ready) {
        field.classList.add("is-ready");
        ready = true;
      }
      frameId = requestAnimationFrame(renderFrame);
    };

    const start = () => {
      if (frameId || !visible || document.hidden || reducedMotion.matches) return;
      previousTime = performance.now();
      frameId = requestAnimationFrame(renderFrame);
    };

    const onPointerEnter = (event: PointerEvent) => {
      if (!finePointer.matches) return;
      updateBounds();
      pointer.inside = true;
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      pointer.lastX = pointer.x;
      pointer.lastY = pointer.y;
      pointer.lastTime = performance.now();
      start();
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!finePointer.matches) return;
      const now = performance.now();
      const x = clamp(event.clientX - rect.left, 0, dimensions.width);
      const y = clamp(event.clientY - rect.top, 0, dimensions.height);
      const elapsedSinceMove = Math.max(8, now - pointer.lastTime);
      pointer.velocityX = clamp((x - pointer.lastX) / elapsedSinceMove * 16.67, -38, 38);
      pointer.velocityY = clamp((y - pointer.lastY) / elapsedSinceMove * 16.67, -38, 38);
      pointer.x = x;
      pointer.y = y;
      pointer.lastX = x;
      pointer.lastY = y;
      pointer.lastTime = now;
    };

    const onPointerLeave = () => {
      pointer.inside = false;
    };

    const onVisibilityChange = () => document.hidden ? stop() : start();
    const onMotionPreferenceChange = () => reducedMotion.matches ? stop() : start();
    const onPointerPreferenceChange = () => {
      pointer.inside = false;
      start();
    };

    const resizeObserver = new ResizeObserver(updateBounds);
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
      else stop();
    }, { threshold: .01 });

    resizeObserver.observe(host);
    intersectionObserver.observe(host);
    host.addEventListener("pointerenter", onPointerEnter);
    host.addEventListener("pointermove", onPointerMove, { passive: true });
    host.addEventListener("pointerleave", onPointerLeave);
    document.addEventListener("visibilitychange", onVisibilityChange);
    reducedMotion.addEventListener("change", onMotionPreferenceChange);
    finePointer.addEventListener("change", onPointerPreferenceChange);
    start();

    return () => {
      stop();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      host.removeEventListener("pointerenter", onPointerEnter);
      host.removeEventListener("pointermove", onPointerMove);
      host.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      reducedMotion.removeEventListener("change", onMotionPreferenceChange);
      finePointer.removeEventListener("change", onPointerPreferenceChange);
      field.classList.remove("is-ready");
    };
  }, []);

  return (
    <div ref={fieldRef} className="rose-petal-field" aria-hidden="true">
      <div ref={lightRef} className="rose-pointer-light" />
      {PETALS.map((petal, index) => (
        <span
          ref={(element) => { petalRefs.current[index] = element; }}
          className="rose-petal"
          data-mobile-hidden={index >= 4 ? "true" : undefined}
          key={`${petal.asset}-${index}`}
          style={{
            width: `${petal.size}px`,
            opacity: petal.opacity,
            filter: petal.blur ? `blur(${petal.blur}px)` : undefined,
            backgroundImage: `url(${petal.asset})`,
          }}
        />
      ))}
    </div>
  );
}
