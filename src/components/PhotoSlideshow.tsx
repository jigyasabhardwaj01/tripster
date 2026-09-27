"use client";

import { useEffect, useMemo, useState } from "react";

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Ambient, non-interactive hero slideshow: no arrows or dots, cross-fades
 * every 4 to 5 seconds. Every image is mounted (just opacity 0 except the
 * current one) so the "next" image is always already loaded by the time it
 * becomes current — no blank flash on switch. Falls back to a plain warm
 * gradient (no broken image icon) when the image list is empty, and to one
 * static frame under prefers-reduced-motion.
 */
export default function PhotoSlideshow({ images }: { images: string[] }) {
  const order = useMemo(() => shuffle(images), [images]);
  const [index, setIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (reducedMotion || order.length <= 1) return;
    const delay = 4000 + Math.random() * 1000; // 4 to 5 seconds
    const timer = setTimeout(() => setIndex((i) => (i + 1) % order.length), delay);
    return () => clearTimeout(timer);
  }, [index, order.length, reducedMotion]);

  if (order.length === 0) {
    return <div className="absolute inset-0 bg-gradient-to-br from-teal-100 via-paper to-amber-50" />;
  }

  const visibleOrder = reducedMotion ? [order[0]] : order;

  return (
    <div className="absolute inset-0 overflow-hidden bg-ink">
      {visibleOrder.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ease-in-out"
          style={{ opacity: i === index ? 1 : 0 }}
        />
      ))}
      {/* Warm-tone gradient so headline/button text stays readable over any photo. */}
      <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/10 to-ink/30" />
    </div>
  );
}
