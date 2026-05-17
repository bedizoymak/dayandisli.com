// Helical Gear Calculation Utilities

export type HelixDirection = "Sağ" | "Sol";

export interface HelicalGearParams {
  mn: number;
  z: number;
  alphaDeg: number;
  betaDeg: number;
  helixDirection: HelixDirection;
}

export interface HelicalGearResult {
  mn: number;
  z: number;
  alphaDeg: number;
  alphaRad: number;
  betaDeg: number;
  betaRad: number;
  helixDirection: HelixDirection;
  diameter: number;
  k: number;
  kFloor: number;
  kCeil: number;
  EW: number;
  wkFloor: number;
  wkCeil: number;
  taksimatRatio: number;
  helicalGearRatio: number;
}

export function computeHelicalParams(
  mn: number,
  z: number,
  alphaDeg: number,
  betaDeg: number,
  helixDirection: HelixDirection
): HelicalGearResult {
  // Convert angles to radians
  const alphaRad = (alphaDeg * Math.PI) / 180;
  const betaRad = (betaDeg * Math.PI) / 180;

  // Helical diameter: d = (mn / cos(β)) * Z + 2mn
  const diameter = (mn / Math.cos(betaRad)) * z + 2 * mn;

  // x angle calculation: x = arctan(tan(alphaRad) / cos(betaRad))
  const xRad = Math.atan(Math.tan(alphaRad) / Math.cos(betaRad));
  const xDeg = (xRad * 180) / Math.PI;

  // y for EW calculation
  const y = (xDeg * Math.PI) / 180;

  // EW helical: |y - tan(xRad)|
  const EW = Math.abs(y - Math.tan(xRad));

  // k calculation: k = (α * Z / 180) + 0.5
  const k = (alphaDeg * z) / 180 + 0.5;
  let kFloor = Math.floor(k);
  let kCeil = Math.ceil(k);

  // Clamp k values: kFloor >= 2, kCeil >= 3
  if (kFloor < 2) kFloor = 2;
  if (kCeil < 3) kCeil = 3;

  // Base for Wk calculation
  const base = mn * Math.cos(alphaRad);

  // Wk values
  const wkFloor = base * ((kFloor - 0.5) * Math.PI + z * EW);
  const wkCeil = base * ((kCeil - 0.5) * Math.PI + z * EW);

  // Taksimat ratio: 16 / Z (for helical)
  const taksimatRatio = 16 / z;

  // Helical gear ratio: sin(betaRad) * 18 / (π * mn)
  const helicalGearRatio = parseFloat(
    ((Math.sin(betaRad) * 18) / (Math.PI * mn)).toFixed(6)
  );

  return {
    mn,
    z,
    alphaDeg,
    alphaRad,
    betaDeg,
    betaRad,
    helixDirection,
    diameter,
    k,
    kFloor,
    kCeil,
    EW,
    wkFloor,
    wkCeil,
    taksimatRatio,
    helicalGearRatio,
  };
}

export function validateHelicalInputs(
  mn: number,
  z: number,
  betaDeg: number
): string[] {
  const errors: string[] = [];

  if (mn < 0.3 || mn > 3.0) {
    errors.push("Modül 0.3 ile 3.0 arasında olmalıdır");
  }

  if (z < 6) {
    errors.push("Diş sayısı en az 6 olmalıdır");
  }

  if (betaDeg < 0 || betaDeg > 45) {
    errors.push("Helis açısı 0 ile 45 derece arasında olmalıdır");
  }

  return errors;
}
