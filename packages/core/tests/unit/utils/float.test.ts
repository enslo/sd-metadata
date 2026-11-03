import { describe, expect, it } from 'vitest';
import { fromFloat32, withoutFloatNoise } from '../../../src/utils/float';

describe('fromFloat32', () => {
  it('should restore the shortest decimal of a float32 widened to double', () => {
    // Draw Things: "scale":1.3999999761581421, "weight":0.30000001192092896
    expect(fromFloat32(1.3999999761581421)).toBe(1.4);
    expect(fromFloat32(0.30000001192092896)).toBe(0.3);
    expect(fromFloat32(0.69999998807907104)).toBe(0.7);
    expect(fromFloat32(Math.fround(2.75))).toBe(2.75);
    expect(fromFloat32(Math.fround(-0.85))).toBe(-0.85);
  });

  it('should keep the digits a float32 needs', () => {
    // The float32 nearest to 1.2345678 needs all eight significant digits
    expect(fromFloat32(Math.fround(1.2345678))).toBe(1.2345678);
  });

  it('should leave genuine doubles unchanged', () => {
    expect(fromFloat32(1.4)).toBe(1.4);
    expect(fromFloat32(0.1 + 0.2)).toBe(0.1 + 0.2);
    expect(fromFloat32(1.3999999999999999)).toBe(1.4);
  });

  it('should leave exact and non-finite values unchanged', () => {
    expect(fromFloat32(0)).toBe(0);
    expect(fromFloat32(7)).toBe(7);
    expect(fromFloat32(1024)).toBe(1024);
    expect(fromFloat32(-0.5)).toBe(-0.5);
    expect(fromFloat32(Number.NaN)).toBeNaN();
    expect(fromFloat32(Number.POSITIVE_INFINITY)).toBe(
      Number.POSITIVE_INFINITY,
    );
  });
});

describe('withoutFloatNoise', () => {
  it('should drop the rounding error of a short decimal', () => {
    // ComfyUI's frontend: "strength_model": 1.0000000000000002,
    // "scale_by": 1.5000000000000002, "denoise": 0.35000000000000003
    expect(withoutFloatNoise(1.0000000000000002)).toBe(1);
    expect(withoutFloatNoise(1.5000000000000002)).toBe(1.5);
    expect(withoutFloatNoise(0.6000000000000001)).toBe(0.6);
    expect(withoutFloatNoise(0.35000000000000003)).toBe(0.35);
    expect(withoutFloatNoise(5.000000000000001)).toBe(5);
    expect(withoutFloatNoise(0.1 + 0.2)).toBe(0.3);
    expect(withoutFloatNoise(-0.7000000000000001)).toBe(-0.7);
  });

  it('should keep a value that needs its digits', () => {
    // Stability Matrix's denoise slider: a genuine 16-digit double
    expect(withoutFloatNoise(0.2958477508650519)).toBe(0.2958477508650519);
    expect(withoutFloatNoise(Math.PI)).toBe(Math.PI);
    expect(withoutFloatNoise(1 / 3)).toBe(1 / 3);
  });

  it('should leave short, integer and non-finite values unchanged', () => {
    expect(withoutFloatNoise(0.35)).toBe(0.35);
    expect(withoutFloatNoise(7)).toBe(7);
    expect(withoutFloatNoise(0)).toBe(0);
    expect(withoutFloatNoise(Number.NaN)).toBeNaN();
    expect(withoutFloatNoise(Number.POSITIVE_INFINITY)).toBe(
      Number.POSITIVE_INFINITY,
    );
  });
});
