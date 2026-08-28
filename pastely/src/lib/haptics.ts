export function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    /* haptics unsupported — silent no-op */
  }
}
