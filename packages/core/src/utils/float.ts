/**
 * Single-precision float recovery
 *
 * Some tools keep their settings in single precision (`Float` in Swift) and
 * serialize them through a double, so a CFG of 1.4 arrives as
 * `1.3999999761581421`: the float32 nearest to 1.4, printed with the 17
 * digits a double needs. The decimal the user actually set is the shortest
 * one that rounds to that same float32, which is also how the tool itself
 * displays the value.
 */

/** Significant digits that let any float32 round-trip through decimal */
const FLOAT32_MAX_DIGITS = 9;

/**
 * Undo the float32 → double widening of a number
 *
 * Returns the shortest decimal that rounds to the same float32 as `value`
 * (1.3999999761581421 → 1.4, 0.30000001192092896 → 0.3). A value that is
 * not exactly representable as float32 is a genuine double (1.4 parsed from
 * `1.3999999999999999`, say) and is returned unchanged, as are non-finite
 * values.
 *
 * @param value - Number read from JSON
 * @returns The value as the user set it
 */
export function fromFloat32(value: number): number {
  if (!Number.isFinite(value) || Math.fround(value) !== value) return value;

  for (let digits = 1; digits <= FLOAT32_MAX_DIGITS; digits++) {
    const short = Number(value.toPrecision(digits));
    if (Math.fround(short) === value) return short;
  }
  return value;
}
