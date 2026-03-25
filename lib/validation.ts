import type { UserProfile, WeightUnit } from "@/lib/types";

export function parseUserProfile(body: unknown): UserProfile {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid body");
  }
  const o = body as Record<string, unknown>;
  const goal = typeof o.goal === "string" ? o.goal.trim() : "";
  if (!goal || goal.length > 280) {
    throw new Error("Goal is required (max 280 characters)");
  }
  const trainingDaysPerWeek = Number(o.trainingDaysPerWeek);
  if (
    !Number.isInteger(trainingDaysPerWeek) ||
    trainingDaysPerWeek < 1 ||
    trainingDaysPerWeek > 7
  ) {
    throw new Error("Training days must be 1–7");
  }
  const rawNotes = typeof o.notes === "string" ? o.notes.trim() : "";
  if (rawNotes.length > 2000) {
    throw new Error("Notes must be at most 2000 characters");
  }
  const notes = rawNotes;
  const dateOfBirth =
    typeof o.dateOfBirth === "string" ? o.dateOfBirth.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
    throw new Error("Date of birth must be YYYY-MM-DD");
  }
  const weightUnit: WeightUnit =
    o.weightUnit === "lb" ? "lb" : "kg";
  const weight = Number(o.weight);
  if (Number.isNaN(weight) || weight <= 0 || weight > 500) {
    throw new Error("Weight must be a positive number");
  }
  const maxHr = Number(o.maxHr);
  const lthr = Number(o.lthr);
  const ftp = Number(o.ftp);
  if (Number.isNaN(maxHr) || maxHr < 100 || maxHr > 230) {
    throw new Error("Max HR should be between 100 and 230 bpm");
  }
  if (Number.isNaN(lthr) || lthr < 100 || lthr > 220) {
    throw new Error("LTHR should be between 100 and 220 bpm");
  }
  if (Number.isNaN(ftp) || ftp < 50 || ftp > 600) {
    throw new Error("FTP should be between 50 and 600 W");
  }

  return {
    goal,
    trainingDaysPerWeek,
    notes,
    dateOfBirth,
    weight,
    weightUnit,
    maxHr,
    lthr,
    ftp,
  };
}
