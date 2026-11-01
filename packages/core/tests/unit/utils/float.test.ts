import { describe, expect, it } from 'vitest';
import { fromFloat32 } from '../../../src/utils/float';

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
