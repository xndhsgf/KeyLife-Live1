export const MAX_AMOUNT = 100000000000; // 100 Billion
export const MAX_LEVEL = 100;

/**
 * Calculates level based on total amount.
 * Uses cubic root for better progression (early levels are easier).
 */
export function calculateLevel(amount: number = 0): number {
  if (amount <= 0) return 1;
  if (amount >= MAX_AMOUNT) return MAX_LEVEL;
  
  // Formula: Level = floor(pow(amount / MAX_AMOUNT, 1/3) * 99) + 1
  const level = Math.floor(Math.pow(amount / MAX_AMOUNT, 1/3) * 99) + 1;
  return Math.min(MAX_LEVEL, Math.max(1, level));
}

/**
 * Gets the progress percentage to the next level.
 */
export function getProgressToNextLevel(amount: number = 0): number {
  const currentLevel = calculateLevel(amount);
  if (currentLevel >= MAX_LEVEL) return 100;
  
  const currentLevelAmount = getAmountForLevel(currentLevel);
  const nextLevelAmount = getAmountForLevel(currentLevel + 1);
  
  const progress = ((amount - currentLevelAmount) / (nextLevelAmount - currentLevelAmount)) * 100;
  return Math.min(100, Math.max(0, progress));
}

/**
 * Gets the amount required for a specific level.
 */
export function getAmountForLevel(level: number): number {
  if (level <= 1) return 0;
  if (level >= MAX_LEVEL) return MAX_AMOUNT;
  
  // Inverse of the level formula
  return Math.pow((level - 1) / 99, 3) * MAX_AMOUNT;
}
