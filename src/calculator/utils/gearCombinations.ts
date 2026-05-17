// Gear Combination Calculation Utilities

export interface GearCombination {
  a: number;
  b: number;
  c: number | null;
  d: number | null;
  ratio: number;
}

// Spur gear list (Taksimat)
export const GEAR_LIST_TAKSIMAT = [
  24, 25, 30, 30, 32, 33, 34, 36, 40, 41, 50, 51, 52, 53, 54,
  55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69,
  70, 71, 72, 75, 76, 80, 85, 90, 90, 94, 96
];

// Helical gear list
export const GEAR_LIST_HELICAL = [
  22, 23, 23, 24, 25, 28, 30, 32, 35, 36, 38, 40, 42, 42, 44, 45,
  46, 47, 47, 49, 50, 52, 53, 54, 55, 58, 60, 69, 75, 80, 89
];

function findTwoGearCombinations(
  targetRatio: number,
  gearList: number[],
  tolerance: number
): GearCombination[] {
  const combinations: GearCombination[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < gearList.length; i++) {
    for (let j = 0; j < gearList.length; j++) {
      if (i === j) continue;

      const a = gearList[i];
      const b = gearList[j];
      const ratio = a / b;

      if (Math.abs(ratio - targetRatio) <= tolerance) {
        const key = `${Math.min(a, b)}-${Math.max(a, b)}`;
        if (!seen.has(key)) {
          seen.add(key);
          combinations.push({ a, b, c: null, d: null, ratio });
        }
      }
    }
  }

  return combinations;
}

function findFourGearCombinations(
  targetRatio: number,
  gearList: number[],
  tolerance: number
): GearCombination[] {
  const combinations: GearCombination[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < gearList.length; i++) {
    for (let j = 0; j < gearList.length; j++) {
      for (let k = 0; k < gearList.length; k++) {
        for (let l = 0; l < gearList.length; l++) {
          if (i === j || i === k || i === l || j === k || j === l || k === l) continue;

          const a = gearList[i];
          const b = gearList[j];
          const c = gearList[k];
          const d = gearList[l];

          // Ratio: (A * C) / (B * D)
          const ratio = (a * c) / (b * d);

          if (Math.abs(ratio - targetRatio) <= tolerance) {
            const sorted = [a, b, c, d].sort((x, y) => x - y);
            const key = sorted.join("-");
            if (!seen.has(key)) {
              seen.add(key);
              combinations.push({ a, b, c, d, ratio });
            }
          }
        }
      }
    }
  }

  return combinations;
}

export function findSpurCombinations(z: number, maxResults = 10): GearCombination[] {
  const targetRatio = 8 / z;
  const tolerance = 1e-9;

  // First find 2-gear combinations
  const twoGear = findTwoGearCombinations(targetRatio, GEAR_LIST_TAKSIMAT, tolerance);

  if (twoGear.length >= maxResults) {
    return twoGear.slice(0, maxResults);
  }

  // If not enough, add 4-gear combinations
  const fourGear = findFourGearCombinations(targetRatio, GEAR_LIST_TAKSIMAT, tolerance);
  const combined = [...twoGear, ...fourGear];

  return combined.slice(0, maxResults);
}

export function findHelicalCombinations(
  helicalRatio: number,
  maxResults = 10
): GearCombination[] {
  const tolerance = 0.001;

  // First find 2-gear combinations
  const twoGear = findTwoGearCombinations(helicalRatio, GEAR_LIST_HELICAL, tolerance);

  if (twoGear.length >= maxResults) {
    return twoGear.slice(0, maxResults);
  }

  // If not enough, add 4-gear combinations
  const fourGear = findFourGearCombinations(helicalRatio, GEAR_LIST_HELICAL, tolerance);
  const combined = [...twoGear, ...fourGear];

  return combined.slice(0, maxResults);
}

export function findTaksimatCombinations(z: number, maxResults = 10): GearCombination[] {
  // For helical, taksimat uses 16/Z
  const targetRatio = 16 / z;
  const tolerance = 1e-9;

  const twoGear = findTwoGearCombinations(targetRatio, GEAR_LIST_TAKSIMAT, tolerance);

  if (twoGear.length >= maxResults) {
    return twoGear.slice(0, maxResults);
  }

  const fourGear = findFourGearCombinations(targetRatio, GEAR_LIST_TAKSIMAT, tolerance);
  return [...twoGear, ...fourGear].slice(0, maxResults);
}
