export const STYLE_FEATURE_NAMES = [
  "cohesion",
  "restraint",
  "mobility",
  "infantry_strength",
  "artillery_formation",
  "artillery_pressure",
  "artillery_protection",
  "paratrooper_readiness",
  "paratrooper_survival",
  "hq_safety",
  "initiative",
  "material_conservation",
] as const;

export type StyleFeatureName = (typeof STYLE_FEATURE_NAMES)[number];
export type PersonalityId =
  | "balanced"
  | "fortress"
  | "mobile_raider"
  | "battery_commander"
  | "para_specialist"
  | "tactical_gambler";

export interface PersonalityProfile {
  id: PersonalityId;
  name: string;
  description: string;
  styleWeights: Partial<Record<StyleFeatureName, number>>;
  /** Largest objective win-probability loss this style may accept. */
  maxValueSacrifice: number;
  /** Maximum personality adjustment in log-odds units. */
  styleBonusCap: number;
  /** Log-odds penalty applied to a candidate with normalized risk 1. */
  riskAversion: number;
  /** Future self-play/search control; zero is deterministic. */
  explorationTemperature: number;
  /** Future search control for allocating forcing-line nodes. */
  tacticalSearchBias: number;
}

export const PERSONALITIES: Record<PersonalityId, PersonalityProfile> = {
  balanced: {
    id: "balanced",
    name: "Balanced",
    description: "Follows objective win probability with minimal stylistic distortion.",
    styleWeights: {},
    maxValueSacrifice: 0.015,
    styleBonusCap: 0.08,
    riskAversion: 0.1,
    explorationTemperature: 0.04,
    tacticalSearchBias: 1,
  },
  fortress: {
    id: "fortress",
    name: "Fortress",
    description: "Keeps units mutually supported and makes the HQ difficult to penetrate.",
    styleWeights: {
      cohesion: 0.3,
      restraint: 0.25,
      artillery_protection: 0.22,
      hq_safety: 0.38,
      material_conservation: 0.14,
      mobility: -0.05,
    },
    maxValueSacrifice: 0.02,
    styleBonusCap: 0.25,
    riskAversion: 0.2,
    explorationTemperature: 0.03,
    tacticalSearchBias: 0.9,
  },
  mobile_raider: {
    id: "mobile_raider",
    name: "Mobile Raider",
    description: "Preserves mobile infantry and seeks open-board initiative.",
    styleWeights: {
      mobility: 0.45,
      infantry_strength: 0.28,
      initiative: 0.25,
      restraint: -0.1,
      artillery_formation: -0.12,
      material_conservation: -0.08,
    },
    maxValueSacrifice: 0.04,
    styleBonusCap: 0.28,
    riskAversion: 0.07,
    explorationTemperature: 0.1,
    tacticalSearchBias: 1.05,
  },
  battery_commander: {
    id: "battery_commander",
    name: "Battery Commander",
    description: "Builds protected artillery formations and sustained multi-piece pressure.",
    styleWeights: {
      artillery_formation: 0.45,
      artillery_pressure: 0.36,
      artillery_protection: 0.3,
      cohesion: 0.1,
      mobility: -0.08,
    },
    maxValueSacrifice: 0.035,
    styleBonusCap: 0.3,
    riskAversion: 0.11,
    explorationTemperature: 0.07,
    tacticalSearchBias: 1.1,
  },
  para_specialist: {
    id: "para_specialist",
    name: "Para Specialist",
    description: "Preserves airborne deterrence and values supported extraction routes.",
    styleWeights: {
      paratrooper_readiness: 0.46,
      paratrooper_survival: 0.42,
      initiative: 0.14,
      infantry_strength: 0.1,
      material_conservation: 0.08,
    },
    maxValueSacrifice: 0.035,
    styleBonusCap: 0.3,
    riskAversion: 0.12,
    explorationTemperature: 0.06,
    tacticalSearchBias: 1.15,
  },
  tactical_gambler: {
    id: "tactical_gambler",
    name: "Tactical Gambler",
    description: "Accepts volatile positions to maximize forcing pressure and initiative.",
    styleWeights: {
      initiative: 0.46,
      artillery_pressure: 0.26,
      mobility: 0.16,
      restraint: -0.22,
      material_conservation: -0.25,
      hq_safety: -0.05,
    },
    maxValueSacrifice: 0.07,
    styleBonusCap: 0.35,
    riskAversion: 0.02,
    explorationTemperature: 0.18,
    tacticalSearchBias: 1.4,
  },
};

export function personality(id: PersonalityId): PersonalityProfile {
  return PERSONALITIES[id];
}
