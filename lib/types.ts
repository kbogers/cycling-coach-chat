export type WeightUnit = "kg" | "lb";

export type UserProfile = {
  goal: string;
  trainingDaysPerWeek: number;
  /** Free-form context for the coach (injuries, schedule quirks, preferences). */
  notes: string;
  dateOfBirth: string;
  weight: number;
  weightUnit: WeightUnit;
  maxHr: number;
  lthr: number;
  ftp: number;
};

export type StravaTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

export type AthleteSummary = {
  id: number;
  firstname: string;
  lastname: string;
  profile?: string;
};
