// Weight Calculation Utility

export interface WeightParams {
  diameter: number; // mm
  length: number; // mm
  density: number; // g/cm³
}

export interface WeightResult {
  volumeMm3: number;
  volumeCm3: number;
  weightGrams: number;
  weightKg: number;
}

export function computeWeight(
  diameter: number,
  length: number,
  density: number
): WeightResult {
  // Treat as solid cylinder
  const radius = diameter / 2;

  // Volume in mm³: π * r² * h
  const volumeMm3 = Math.PI * radius * radius * length;

  // Convert mm³ to cm³ (1 cm³ = 1000 mm³)
  const volumeCm3 = volumeMm3 / 1000;

  // Weight in grams
  const weightGrams = volumeCm3 * density;

  // Convert to kg
  const weightKg = weightGrams / 1000;

  return {
    volumeMm3,
    volumeCm3,
    weightGrams,
    weightKg,
  };
}

// Common material densities (g/cm³)
export const MATERIAL_DENSITIES = {
  steel: 7.85,
  stainlessSteel: 8.0,
  aluminum: 2.7,
  brass: 8.5,
  bronze: 8.8,
  copper: 8.96,
  cast_iron: 7.2,
  titanium: 4.5,
};
