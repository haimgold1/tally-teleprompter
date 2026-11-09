export type Aspect = '9:16' | '16:9';

export const aspectRatio = (aspect: Aspect): number => (aspect === '9:16' ? 9 / 16 : 16 / 9);

export interface CropRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

export interface Pipeline {
  mode: 'direct' | 'crop';
  outW: number;
  outH: number;
}

/** Camera output within this fraction of the target is recorded without a canvas. */
const ASPECT_TOLERANCE = 0.03;

const even = (value: number): number => Math.max(2, Math.floor(value / 2) * 2);

/** Largest centred rectangle of the source that has the target ratio. */
export function centerCrop(srcW: number, srcH: number, ratio: number): CropRect {
  if (srcW / srcH > ratio) {
    const sw = srcH * ratio;
    return { sx: (srcW - sw) / 2, sy: 0, sw, sh: srcH };
  }
  const sh = srcW / ratio;
  return { sx: 0, sy: (srcH - sh) / 2, sw: srcW, sh };
}

/**
 * Direct recording is cheapest and sharpest, so it is used whenever the camera
 * already delivers the target aspect. Otherwise frames go through a crop canvas.
 */
export function decidePipeline(srcW: number, srcH: number, aspect: Aspect): Pipeline {
  const target = aspectRatio(aspect);
  if (Math.abs(srcW / srcH - target) / target <= ASPECT_TOLERANCE) {
    return { mode: 'direct', outW: srcW, outH: srcH };
  }
  const { sw, sh } = centerCrop(srcW, srcH, target);
  return { mode: 'crop', outW: even(sw), outH: even(sh) };
}
