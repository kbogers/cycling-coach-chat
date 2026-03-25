"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { track } from "@vercel/analytics";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  clearDraft,
  loadDraft,
  saveDraft,
  type OnboardingDraft,
} from "@/lib/onboarding-storage";
import type { WeightUnit } from "@/lib/types";

const STEPS = 5;

const defaultDraft = (): OnboardingDraft => ({
  step: 1,
  goal: "",
  trainingDaysPerWeek: 4,
  notes: "",
  dateOfBirth: "",
  weight: 75,
  weightUnit: "kg",
  maxHr: 185,
  lthr: 170,
  ftp: 250,
  geminiApiKey: "",
});

export function OnboardingWizard() {
  const searchParams = useSearchParams();
  const oauthError = searchParams.get("error");

  const [draft, setDraft] = useState<OnboardingDraft>(defaultDraft);
  const [hydrated, setHydrated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [validatingKey, setValidatingKey] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = loadDraft();
    if (saved) {
      setDraft({
        ...defaultDraft(),
        ...saved,
        notes: typeof saved.notes === "string" ? saved.notes : "",
      });
    }
    setHydrated(true);
    track("onboarding_started");
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveDraft(draft);
  }, [draft, hydrated]);

  const progress = useMemo(
    () => Math.round((draft.step / STEPS) * 100),
    [draft.step]
  );

  const setField = useCallback(<K extends keyof OnboardingDraft>(key: K, value: OnboardingDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
  }, []);

  const goNext = useCallback(async () => {
    setError(null);
    if (draft.step === 1) {
      if (!draft.goal.trim()) {
        setError("Please describe your goal.");
        return;
      }
      if (draft.goal.length > 280) {
        setError("Goal must be at most 280 characters.");
        return;
      }
    }
    if (draft.step === 2) {
      if (draft.notes.length > 2000) {
        setError("Notes must be at most 2000 characters.");
        return;
      }
    }
    if (draft.step === 3) {
      if (!draft.dateOfBirth) {
        setError("Date of birth is required.");
        return;
      }
    }
    if (draft.step === 4) {
      const key = draft.geminiApiKey?.trim();
      if (!key) {
        setError("Gemini API key is required.");
        return;
      }
      setValidatingKey(true);
      try {
        const res = await fetch("/api/gemini/validate-key", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey: key }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          throw new Error(data.error || "Could not verify API key.");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Verification failed.");
        setValidatingKey(false);
        return;
      }
      setValidatingKey(false);
    }
    if (draft.step < STEPS) {
      track("onboarding_step_completed", { step: draft.step });
      setDraft((d) => ({ ...d, step: d.step + 1 }));
    }
  }, [draft]);

  const goBack = useCallback(() => {
    setError(null);
    if (draft.step > 1) {
      setDraft((d) => ({ ...d, step: d.step - 1 }));
    }
  }, [draft.step]);

  const connectStrava = useCallback(async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/onboarding/pending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: draft.goal,
          trainingDaysPerWeek: draft.trainingDaysPerWeek,
          notes: draft.notes,
          dateOfBirth: draft.dateOfBirth,
          weight: draft.weight,
          weightUnit: draft.weightUnit,
          maxHr: draft.maxHr,
          lthr: draft.lthr,
          ftp: draft.ftp,
          geminiApiKey: draft.geminiApiKey,
        }),
      });
      const data = (await res.json()) as { pendingId?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Could not start Strava connection.");
      }
      if (!data.pendingId) {
        throw new Error("Missing pending session.");
      }
      clearDraft();
      window.location.href = `/api/auth/strava?pendingId=${encodeURIComponent(data.pendingId)}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setSubmitting(false);
    }
  }, [draft]);

  const ftpWarning =
    draft.ftp < 80 || draft.ftp > 450
      ? "FTP is outside a typical range — double-check if this is intentional."
      : null;

  if (!hydrated) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg items-center justify-center p-6">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 p-6 pb-12">
      <div className="space-y-2">
        <h1 className="font-semibold text-2xl tracking-tight">AI Cycling Coach</h1>
        <p className="text-muted-foreground text-sm">
          Set up in a few steps, then chat with your coach using your Strava data.
        </p>
        <Progress value={progress} className="h-2" />
        <p className="text-muted-foreground text-xs">
          Step {draft.step} of {STEPS}
        </p>
      </div>

      {(error || oauthError) && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error ||
              (oauthError === "session_expired_retry"
                ? "Onboarding session expired. Please complete the steps again."
                : oauthError === "strava_tls"
                  ? "Could not verify Strava’s HTTPS certificate from Node (TLS issue). On a personal machine this is often antivirus “HTTPS scanning,” a VPN, a debug proxy (Charles, mitmproxy), or a bad system clock. Try disabling scanning/VPN temporarily, update Node to current LTS, or set NODE_EXTRA_CA_CERTS to a PEM with the missing root CA if your vendor documents one."
                  : oauthError === "strava_callback_failed"
                    ? "Strava sign-in failed after authorization. Try again or check the server logs."
                    : oauthError || "Strava authorization failed.")}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          {draft.step === 1 && (
            <>
              <CardTitle>Your goal</CardTitle>
              <CardDescription>
                What are you training for? One clear sentence helps the coach
                stay focused.
              </CardDescription>
            </>
          )}
          {draft.step === 2 && (
            <>
              <CardTitle>Training availability</CardTitle>
              <CardDescription>
                How many days per week can you train, and anything else the
                coach should keep in mind?
              </CardDescription>
            </>
          )}
          {draft.step === 3 && (
            <>
              <CardTitle>Physical profile</CardTitle>
              <CardDescription>
                Used to interpret power and heart-rate data in context.
              </CardDescription>
            </>
          )}
          {draft.step === 4 && (
            <>
              <CardTitle>Gemini API key</CardTitle>
              <CardDescription>
                Your key is encrypted on the server and never exposed in the
                browser.{" "}
                <Link
                  href="https://aistudio.google.com/apikey"
                  className="text-primary underline underline-offset-4"
                  target="_blank"
                  rel="noreferrer"
                >
                  Create a key in Google AI Studio
                </Link>
                .
              </CardDescription>
            </>
          )}
          {draft.step === 5 && (
            <>
              <CardTitle>Connect Strava</CardTitle>
              <CardDescription>
                Authorise read access to your activities so answers can use your
                real training history.
              </CardDescription>
            </>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {draft.step === 1 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="goal">Goal</Label>
                <Textarea
                  id="goal"
                  placeholder='e.g. Finish a gran fondo in under 5 hours by August.'
                  maxLength={280}
                  rows={4}
                  value={draft.goal}
                  onChange={(e) => setField("goal", e.target.value)}
                />
                <p className="text-muted-foreground text-xs">
                  {draft.goal.length}/280
                </p>
              </div>
            </>
          )}

          {draft.step === 2 && (
            <>
              <div className="space-y-2">
                <Label>Days per week</Label>
                <Select
                  value={String(draft.trainingDaysPerWeek)}
                  onValueChange={(v) =>
                    setField("trainingDaysPerWeek", Number(v))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} {n === 1 ? "day" : "days"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes for your coach (optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="e.g. Old knee injury — avoid long climbs two days in a row. Prefer morning rides."
                  rows={4}
                  maxLength={2000}
                  value={draft.notes}
                  onChange={(e) => setField("notes", e.target.value)}
                />
                <p className="text-muted-foreground text-xs">
                  {draft.notes.length}/2000 — injuries, schedule limits, or
                  preferences the assistant should remember.
                </p>
              </div>
            </>
          )}

          {draft.step === 3 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="dob">Date of birth</Label>
                <Input
                  id="dob"
                  type="date"
                  value={draft.dateOfBirth}
                  onChange={(e) => setField("dateOfBirth", e.target.value)}
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="weight">Weight</Label>
                  <Input
                    id="weight"
                    type="number"
                    step="0.1"
                    min={1}
                    value={draft.weight}
                    onChange={(e) =>
                      setField("weight", Number(e.target.value))
                    }
                  />
                </div>
                <div className="w-28 space-y-2">
                  <Label>Unit</Label>
                  <Select
                    value={draft.weightUnit}
                    onValueChange={(v) =>
                      setField("weightUnit", v as WeightUnit)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kg">kg</SelectItem>
                      <SelectItem value="lb">lb</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="maxhr">
                    Max HR <span className="font-mono text-xs">(bpm)</span>
                  </Label>
                  <Input
                    id="maxhr"
                    type="number"
                    value={draft.maxHr}
                    onChange={(e) =>
                      setField("maxHr", Number(e.target.value))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lthr">
                    LTHR <span className="font-mono text-xs">(bpm)</span>
                  </Label>
                  <Input
                    id="lthr"
                    type="number"
                    value={draft.lthr}
                    onChange={(e) =>
                      setField("lthr", Number(e.target.value))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ftp">
                    FTP <span className="font-mono text-xs">(W)</span>
                  </Label>
                  <Input
                    id="ftp"
                    type="number"
                    value={draft.ftp}
                    onChange={(e) =>
                      setField("ftp", Number(e.target.value))
                    }
                  />
                </div>
              </div>
              {ftpWarning && (
                <Alert>
                  <AlertTitle>Check value</AlertTitle>
                  <AlertDescription>{ftpWarning}</AlertDescription>
                </Alert>
              )}
            </>
          )}

          {draft.step === 4 && (
            <div className="space-y-2">
              <Label htmlFor="gemini">Gemini API key</Label>
              <Input
                id="gemini"
                type="password"
                autoComplete="off"
                value={draft.geminiApiKey ?? ""}
                onChange={(e) => setField("geminiApiKey", e.target.value)}
              />
              <p className="text-muted-foreground text-xs">
                Your key is checked with Google when you continue (no chat
                messages are sent).
              </p>
            </div>
          )}

          {draft.step === 5 && (
            <div className="space-y-4">
              <p className="text-muted-foreground text-sm">
                You’ll leave this site briefly to approve access on Strava, then
                return to the chat.
              </p>
              <Button
                type="button"
                variant="strava"
                size="lg"
                className="w-full"
                disabled={submitting}
                onClick={connectStrava}
              >
                Connect with Strava
              </Button>
              <p className="text-muted-foreground text-xs">
                Strava is a registered trademark. Connect uses Strava’s OAuth
                flow; we only request activity read access.
              </p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={goBack}
            disabled={draft.step === 1}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          {draft.step < 5 && (
            <Button
              type="button"
              onClick={() => void goNext()}
              disabled={validatingKey}
            >
              {validatingKey ? "Verifying key…" : "Continue"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
