import type { RefObject } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { prefersReducedMotion } from '../../lib/platform';
import { FilamentRenderer } from './filament';

interface VoiceFilamentProps {
  live: boolean;
  readBands: (out: Float32Array) => boolean;
  renderer: RefObject<FilamentRenderer | null>;
}

export function VoiceFilament({ live, readBands, renderer }: VoiceFilamentProps) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvas.current) return;
    const instance = new FilamentRenderer(canvas.current, readBands, prefersReducedMotion());
    renderer.current = instance;
    return () => {
      instance.destroy();
      renderer.current = null;
    };
  }, [readBands, renderer]);

  useEffect(() => {
    renderer.current?.setLive(live);
  }, [live, renderer]);

  return <canvas ref={canvas} class="filament" aria-hidden="true" />;
}
