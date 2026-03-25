import type { UserProfile } from "@/lib/types";

function weightKg(p: UserProfile): number {
  if (p.weightUnit === "kg") return p.weight;
  return p.weight * 0.453592;
}

function ageFromDob(dob: string): number {
  const d = new Date(dob);
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
}

export function buildSystemPrompt(
  profile: UserProfile,
  stravaContext: string
): string {
  const wKg = weightKg(profile);
  const wkg = wKg > 0 ? (profile.ftp / wKg).toFixed(2) : "n/a";
  const age = ageFromDob(profile.dateOfBirth);

  return `You are an expert cycling coach. Your role is to help the athlete understand
their training data and make progress toward their goal.

ATHLETE PROFILE
- Goal: ${profile.goal}
- Weekly training availability: ${profile.trainingDaysPerWeek} days/week
${
  profile.notes?.trim()
    ? `- Additional context from the athlete: ${profile.notes.trim()}`
    : ""
}
- Date of birth: ${profile.dateOfBirth} (age: ${age})
- Weight: ${wKg.toFixed(1)} kg
- Max HR: ${profile.maxHr} bpm
- LTHR: ${profile.lthr} bpm
- FTP: ${profile.ftp} W
- W/kg: ${wkg}

RECENT STRAVA DATA
${stravaContext}

Answer questions based on the athlete's actual data. Be specific, not generic.
If data is missing or unclear, say so. Use cycling terminology appropriately.`;
}
