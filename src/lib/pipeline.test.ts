import { describe, expect, it } from 'vitest';
import { centerCrop, decidePipeline } from './pipeline';

describe('decidePipeline', () => {
  it('records directly when the camera matches the target', () => {
    expect(decidePipeline(1080, 1920, '9:16')).toEqual({ mode: 'direct', outW: 1080, outH: 1920 });
    expect(decidePipeline(1920, 1080, '16:9')).toEqual({ mode: 'direct', outW: 1920, outH: 1080 });
  });
  it('tolerates small sensor differences', () => {
    expect(decidePipeline(1088, 1920, '9:16').mode).toBe('direct');
  });
  it('crops a portrait camera to 16:9 with even dimensions', () => {
    const result = decidePipeline(1080, 1920, '16:9');
    expect(result.mode).toBe('crop');
    expect(result.outW).toBe(1080);
    expect(result.outH).toBe(606);
  });
  it('crops a 4:3 sensor to 9:16', () => {
    expect(decidePipeline(1080, 1440, '9:16')).toEqual({ mode: 'crop', outW: 810, outH: 1440 });
  });
});

describe('centerCrop', () => {
  it('removes the sides of a too-wide source', () => {
    expect(centerCrop(1920, 1080, 9 / 16)).toMatchObject({ sy: 0, sh: 1080, sw: 607.5, sx: 656.25 });
  });
  it('removes top and bottom of a too-tall source', () => {
    const crop = centerCrop(1080, 1920, 16 / 9);
    expect(crop.sx).toBe(0);
    expect(crop.sw).toBe(1080);
    expect(crop.sh).toBeCloseTo(607.5);
    expect(crop.sy).toBeCloseTo(656.25);
  });
});
