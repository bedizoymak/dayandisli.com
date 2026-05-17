// Spur Gear Calculation Utilities

export interface SpurGearParams {
  mn: number;
  z: number;
  alphaDeg: number;
  diameter: number;
}

export interface SpurGearResult {
  mn: number;
  z: number;
  alphaDeg: number;
  alphaRad: number;
  diameter: number;
  autoCalculatedDiameter: number;
  k: number;
  kFloor: number;
  kCeil: number;
  EW: number;
  xFactor: number;
  wkFloor: number;
  wkCeil: number;
  taksimatRatio: number;
}

export function computeSpurParams(
  mn: number,
  z: number,
  alphaDeg: number,
  diameterOverride?: number
): SpurGearResult {
  // Convert alpha to radians
  const alphaRad = (alphaDeg * Math.PI) / 180;

  // Auto-calculated diameter: dA = (Z + 2) * mn
  const autoCalculatedDiameter = (z + 2) * mn;
  const diameter = diameterOverride ?? autoCalculatedDiameter;

  // k calculation: k = (α * Z / 180) + 0.5
  const k = (alphaDeg * z) / 180 + 0.5;
  const kFloor = Math.floor(k);
  const kCeil = Math.ceil(k);

  // EW (involute function): EW = |alphaRad - tan(alphaRad)|
  const EW = Math.abs(alphaRad - Math.tan(alphaRad));

  // X_factor (profile/diameter correction)
  const dTarget = autoCalculatedDiameter;
  const diff = diameter - dTarget;
  const tolerance = 1e-9;
  const xFactor = Math.abs(diff) > tolerance ? diff * Math.sin(alphaRad) : 0;

  // Base for Wk calculation
  const base = mn * Math.cos(alphaRad);

  // Wk values
  const wkFloor = base * ((kFloor - 0.5) * Math.PI + z * EW) + xFactor;
  const wkCeil = base * ((kCeil - 0.5) * Math.PI + z * EW) + xFactor;

  // Taksimat ratio: 8 / Z
  const taksimatRatio = 8 / z;

  return {
    mn,
    z,
    alphaDeg,
    alphaRad,
    diameter,
    autoCalculatedDiameter,
    k,
    kFloor,
    kCeil,
    EW,
    xFactor,
    wkFloor,
    wkCeil,
    taksimatRatio,
  };
}

export function validateSpurInputs(mn: number, z: number, diameter: number): string[] {
  const errors: string[] = [];

  if (mn < 0.3 || mn > 3.0) {
    errors.push("Modül 0.3 ile 3.0 arasında olmalıdır");
  }

  if (z < 6) {
    errors.push("Diş sayısı en az 6 olmalıdır");
  }

  if (diameter < 8 || diameter > 250) {
    errors.push("Çap 8 ile 250 mm arasında olmalıdır");
  }

  return errors;
}
