export const MIN_TARGET_SERVINGS = 1;
export const MAX_TARGET_SERVINGS = 50;

/** Facteur à appliquer aux quantités stockées (pour `servings`) pour obtenir `target` portions. */
export function servingsFactor(servings: number, target: number): number {
  if (servings <= 0) return 1;
  return target / servings;
}

export function scaleQuantity(quantity: number, servings: number, target: number): number {
  return quantity * servingsFactor(servings, target);
}
