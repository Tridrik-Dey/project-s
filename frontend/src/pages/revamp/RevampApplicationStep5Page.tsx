import { FormEvent, useEffect, useMemo, useState } from "react";
import { CheckSquare, KeyRound, Save } from "lucide-react";
import { Link, Navigate, useParams } from "react-router-dom";
import {
  getRevampApplicationSections,
  getRevampApplicationSummary,
  saveRevampApplicationSection,
  sendDeclarationOtpChallenge,
  verifyDeclarationOtpChallenge,
  type RevampApplicationSummary
} from "../../api/revampApplicationApi";
import { HttpError } from "../../api/http";
import { useAuth } from "../../auth/AuthContext";
import { useI18n } from "../../i18n/I18nContext";
import { saveRevampApplicationSession } from "../../utils/revampApplicationSession";
import { resolveStepGuardRedirect } from "./revampFlow";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

type Section5Payload = {
  truthfulnessDeclaration: boolean;
  noConflictOfInterest: boolean;
  noCriminalConvictions: boolean;
  privacyAccepted: boolean;
  ethicalCodeAccepted: boolean;
  qualityEnvSafetyAccepted: boolean;
  alboDataProcessingConsent: boolean;
  marketingConsent: boolean;
  dlgs81ComplianceWhenInPresence: boolean;
  antimafiaDeclaration: boolean;
  dlgs231Declaration: boolean;
  model231Adopted: boolean;
  fiscalContributionRegularity: boolean;
  gdprComplianceAndDpo: boolean;
  otpChallengeId: string;
  otpVerified: boolean;
  otpVerifiedAt: string | null;
  otpCode: string;
};

const emptyPayload: Section5Payload = {
  truthfulnessDeclaration: false,
  noConflictOfInterest: false,
  noCriminalConvictions: false,
  privacyAccepted: false,
  ethicalCodeAccepted: false,
  qualityEnvSafetyAccepted: false,
  alboDataProcessingConsent: false,
  marketingConsent: false,
  dlgs81ComplianceWhenInPresence: false,
  antimafiaDeclaration: false,
  dlgs231Declaration: false,
  model231Adopted: false,
  fiscalContributionRegularity: false,
  gdprComplianceAndDpo: false,
  otpChallengeId: "",
  otpVerified: false,
  otpVerifiedAt: null,
  otpCode: ""
};

function parsePayload(payloadJson?: string | null): Section5Payload | null {
  if (!payloadJson) return null;
  try {
    const parsed = JSON.parse(payloadJson) as Record<string, unknown>;
    return {
      ...emptyPayload,
      truthfulnessDeclaration: Boolean(parsed.truthfulnessDeclaration ?? parsed.declarationTruthful),
      noConflictOfInterest: Boolean(parsed.noConflictOfInterest ?? parsed.declarationNoConflict),
      noCriminalConvictions: Boolean(parsed.noCriminalConvictions ?? parsed.declarationNoCriminalConvictions),
      privacyAccepted: Boolean(parsed.privacyAccepted),
      ethicalCodeAccepted: Boolean(parsed.ethicalCodeAccepted),
      qualityEnvSafetyAccepted: Boolean(parsed.qualityEnvSafetyAccepted ?? parsed.qualityStandardsAccepted),
      alboDataProcessingConsent: Boolean(parsed.alboDataProcessingConsent ?? parsed.dataProcessingConsent),
      marketingConsent: Boolean(parsed.marketingConsent),
      dlgs81ComplianceWhenInPresence: Boolean(parsed.dlgs81ComplianceWhenInPresence),
      antimafiaDeclaration: Boolean(parsed.antimafiaDeclaration),
      dlgs231Declaration: Boolean(parsed.dlgs231Declaration),
      model231Adopted: Boolean(parsed.model231Adopted),
      fiscalContributionRegularity: Boolean(parsed.fiscalContributionRegularity),
      gdprComplianceAndDpo: Boolean(parsed.gdprComplianceAndDpo),
      otpChallengeId: String(parsed.otpChallengeId ?? ""),
      otpVerified: Boolean(parsed.otpVerified),
      otpVerifiedAt: typeof parsed.otpVerifiedAt === "string" ? parsed.otpVerifiedAt : null,
      otpCode: typeof parsed.otpCode === "string" ? parsed.otpCode : ""
    };
  } catch {
    return null;
  }
}

function isStep5Completed(payload: Section5Payload, registryType: "ALBO_A" | "ALBO_B", requiresDlgs81: boolean): boolean {
  const requiredChecked =
    payload.truthfulnessDeclaration
    && payload.noConflictOfInterest
    && payload.noCriminalConvictions
    && payload.privacyAccepted
    && payload.ethicalCodeAccepted
    && payload.qualityEnvSafetyAccepted
    && payload.alboDataProcessingConsent;

  const alboARequired = !requiresDlgs81 || payload.dlgs81ComplianceWhenInPresence;
  const alboBRequired =
    payload.antimafiaDeclaration
    && payload.dlgs231Declaration
    && payload.fiscalContributionRegularity
    && payload.gdprComplianceAndDpo;

  const registryRequired = registryType === "ALBO_A" ? alboARequired : alboBRequired;
  return requiredChecked && registryRequired && payload.otpVerified;
}

export function RevampApplicationStep5Page() {
  const { applicationId } = useParams();
  const { auth } = useAuth();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [summary, setSummary] = useState<RevampApplicationSummary | null>(null);
  const [payload, setPayload] = useState<Section5Payload>(emptyPayload);
  const [requiresDlgs81, setRequiresDlgs81] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [guardRedirect, setGuardRedirect] = useState<string | null>(null);
  const [otpHint, setOtpHint] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpBusy, setOtpBusy] = useState(false);

  const completed = useMemo(() => {
    const registryType = summary?.registryType === "ALBO_B" ? "ALBO_B" : "ALBO_A";
    return isStep5Completed(payload, registryType, requiresDlgs81);
  }, [payload, requiresDlgs81, summary?.registryType]);
  const saveLabel = useMemo(() => {
    if (saveState === "saving") return t("revamp.step5.saveState.saving");
    if (saveState === "saved") return lastSavedAt ? t("revamp.step5.saveState.savedAt", { time: lastSavedAt }) : t("revamp.step5.saveState.saved");
    if (saveState === "error") return t("revamp.step5.saveState.error");
    if (saveState === "dirty") return t("revamp.step5.saveState.dirty");
    return t("revamp.step5.saveState.idle");
  }, [lastSavedAt, saveState, t]);

  useEffect(() => {
    async function bootstrap() {
      if (!applicationId || !auth?.token) return;
      setLoading(true);
      setLoadError(null);
      try {
        const appSummary = await getRevampApplicationSummary(applicationId, auth.token);
        setSummary(appSummary);
        saveRevampApplicationSession({
          applicationId,
          status: appSummary.status,
          protocolCode: appSummary.protocolCode,
          updatedAt: appSummary.updatedAt,
          resumePath: `/application/${applicationId}/step/5`
        });
        const sections = await getRevampApplicationSections(applicationId, auth.token);
        const redirect = resolveStepGuardRedirect(applicationId, appSummary.registryType, sections, "step5");
        setGuardRedirect(redirect);
        if (appSummary.registryType === "ALBO_A") {
          const s3a = sections.find((section) => section.sectionKey === "S3A");
          const s3aPayload = s3a?.payloadJson ? JSON.parse(s3a.payloadJson) as Record<string, unknown> : null;
          const inPresenceFromFlag = Boolean(s3aPayload?.teachingInPresence ?? s3aPayload?.inPresenceTeaching);
          const inPresenceFromAvailability = Boolean((s3aPayload?.availability as Record<string, unknown> | undefined)?.inPresence);
          const inPresenceFromExperiences = Array.isArray(s3aPayload?.experiences)
            && s3aPayload.experiences.some((item) => {
              if (!item || typeof item !== "object") return false;
              const mode = String((item as Record<string, unknown>).deliveryMode ?? "").toUpperCase();
              return mode === "IN_PRESENCE" || mode === "AULA" || mode === "BLENDED";
            });
          setRequiresDlgs81(inPresenceFromFlag || inPresenceFromAvailability || inPresenceFromExperiences);
        } else {
          setRequiresDlgs81(false);
        }
        const s5 = sections.find((section) => section.sectionKey === "S5");
        const parsed = parsePayload(s5?.payloadJson);
        if (parsed) {
          setPayload({
            ...emptyPayload,
            ...parsed
          });
        }
        if (s5?.updatedAt) {
          setLastSavedAt(new Date(s5.updatedAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }));
          setSaveState("saved");
        } else {
          setSaveState("idle");
        }
      } catch (error) {
        const message = error instanceof HttpError ? error.message : t("revamp.step5.loadErrorFallback");
        setLoadError(message);
      } finally {
        setLoading(false);
      }
    }
    void bootstrap();
  }, [applicationId, auth?.token, t]);

  function markDirty() {
    setSaveState((prev) => (prev === "saving" ? prev : "dirty"));
  }

  async function sendOtp() {
    if (!applicationId || !auth?.token || otpBusy) return;
    setOtpBusy(true);
    setOtpError(null);
    try {
      const dispatched = await sendDeclarationOtpChallenge(applicationId, auth.token);
      const hint = dispatched.deliveryMode === "SIMULATED"
        ? t("revamp.step5.otp.simulatedHint", { code: dispatched.debugCode ?? "n/d" })
        : t("revamp.step5.otp.sentHint", { email: dispatched.targetEmailMasked });
      setOtpHint(t("revamp.step5.otp.expiresAt", {
        hint,
        time: new Date(dispatched.expiresAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })
      }));
      setPayload((prev) => ({
        ...prev,
        otpChallengeId: dispatched.challengeId,
        otpVerified: false,
        otpVerifiedAt: null
      }));
      markDirty();
    } catch (error) {
      setOtpError(error instanceof HttpError ? error.message : t("revamp.step5.otp.sendError"));
    } finally {
      setOtpBusy(false);
    }
  }

  async function verifyOtp() {
    if (!auth?.token || otpBusy) return;
    if (!payload.otpChallengeId) {
      setOtpError(t("revamp.step5.otp.sendFirst"));
      return;
    }
    if (!/^\d{6}$/.test(payload.otpCode.trim())) {
      setOtpError(t("revamp.step5.otp.invalidCode"));
      return;
    }
    setOtpBusy(true);
    setOtpError(null);
    try {
      const verified = await verifyDeclarationOtpChallenge(payload.otpChallengeId, payload.otpCode.trim(), auth.token);
      setPayload((prev) => ({
        ...prev,
        otpVerified: verified.verified,
        otpVerifiedAt: verified.verifiedAt
      }));
      setOtpHint(t("revamp.step5.otp.verifySuccess"));
      markDirty();
    } catch (error) {
      setOtpError(error instanceof HttpError ? error.message : t("revamp.step5.otp.verifyError"));
      setPayload((prev) => ({ ...prev, otpVerified: false, otpVerifiedAt: null }));
      markDirty();
    } finally {
      setOtpBusy(false);
    }
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (!applicationId || !auth?.token) return;
    setSaveState("saving");
    try {
      const saved = await saveRevampApplicationSection(
        applicationId,
        "S5",
        JSON.stringify(payload),
        completed,
        auth.token
      );
      setLastSavedAt(new Date(saved.updatedAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }));
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  if (!applicationId) return <Navigate to="/apply" replace />;
  if (!auth?.token) return <Navigate to="/login" replace />;

  if (loading) {
    return (
      <section className="stack">
        <div className="panel">
          <h2>{t("revamp.step5.loading")}</h2>
        </div>
      </section>
    );
  }

  if (loadError || !summary) {
    return (
      <section className="stack">
        <div className="panel">
          <h2>{t("revamp.step5.loadFailedTitle")}</h2>
          <p className="error">{loadError ?? t("revamp.common.applicationNotFound")}</p>
          <Link className="home-inline-link home-inline-link-supplier" to="/supplier">
            {t("revamp.common.backToSupplier")}
          </Link>
        </div>
      </section>
    );
  }

  if (guardRedirect && guardRedirect !== `/application/${applicationId}/step/5`) {
    return <Navigate to={guardRedirect} replace />;
  }

  return (
    <section className="stack">
      <div className="panel revamp-step-header">
        <h2>{t("revamp.step5.title")}</h2>
        <p className="subtle">
          {t("revamp.step5.subtitle", { id: applicationId, state: saveLabel })}
        </p>
      </div>

      <form className="panel stack" onSubmit={onSave}>
        <h3 className="revamp-step-subtitle"><CheckSquare className="h-4 w-4" /> {t("revamp.step5.mandatoryConsents")}</h3>
        <label className="review-check-item">
          <input
            type="checkbox"
            checked={payload.truthfulnessDeclaration}
            onChange={(e) => {
              setPayload((prev) => ({ ...prev, truthfulnessDeclaration: e.target.checked }));
              markDirty();
            }}
          />
          <span>{t("revamp.step5.consent.truthful")}</span>
        </label>
        <label className="review-check-item">
          <input
            type="checkbox"
            checked={payload.noConflictOfInterest}
            onChange={(e) => {
              setPayload((prev) => ({ ...prev, noConflictOfInterest: e.target.checked }));
              markDirty();
            }}
          />
          <span>{t("revamp.step5.consent.noConflict")}</span>
        </label>
        <label className="review-check-item">
          <input
            type="checkbox"
            checked={payload.noCriminalConvictions}
            onChange={(e) => {
              setPayload((prev) => ({ ...prev, noCriminalConvictions: e.target.checked }));
              markDirty();
            }}
          />
          <span>{t("revamp.step5.consent.noCriminalConvictions")}</span>
        </label>
        <label className="review-check-item">
          <input
            type="checkbox"
            checked={payload.privacyAccepted}
            onChange={(e) => {
              setPayload((prev) => ({ ...prev, privacyAccepted: e.target.checked }));
              markDirty();
            }}
          />
          <span>{t("revamp.step5.consent.privacy")}</span>
        </label>
        <label className="review-check-item">
          <input
            type="checkbox"
            checked={payload.ethicalCodeAccepted}
            onChange={(e) => {
              setPayload((prev) => ({ ...prev, ethicalCodeAccepted: e.target.checked }));
              markDirty();
            }}
          />
          <span>{t("revamp.step5.consent.ethicalCode")}</span>
        </label>
        <label className="review-check-item">
          <input
            type="checkbox"
            checked={payload.qualityEnvSafetyAccepted}
            onChange={(e) => {
              setPayload((prev) => ({ ...prev, qualityEnvSafetyAccepted: e.target.checked }));
              markDirty();
            }}
          />
          <span>{t("revamp.step5.consent.quality")}</span>
        </label>
        <label className="review-check-item">
          <input
            type="checkbox"
            checked={payload.alboDataProcessingConsent}
            onChange={(e) => {
              setPayload((prev) => ({ ...prev, alboDataProcessingConsent: e.target.checked }));
              markDirty();
            }}
          />
          <span>{t("revamp.step5.consent.alboDataProcessing")}</span>
        </label>
        {summary.registryType === "ALBO_A" ? (
          <label className="review-check-item">
            <input
              type="checkbox"
              checked={payload.dlgs81ComplianceWhenInPresence}
              onChange={(e) => {
                setPayload((prev) => ({ ...prev, dlgs81ComplianceWhenInPresence: e.target.checked }));
                markDirty();
              }}
            />
            <span>
              {requiresDlgs81
                ? t("revamp.step5.consent.dlgs81Required")
                : t("revamp.step5.consent.dlgs81Optional")}
            </span>
          </label>
        ) : null}
        {summary.registryType === "ALBO_B" ? (
          <>
            <label className="review-check-item">
              <input
                type="checkbox"
                checked={payload.antimafiaDeclaration}
                onChange={(e) => {
                  setPayload((prev) => ({ ...prev, antimafiaDeclaration: e.target.checked }));
                  markDirty();
                }}
              />
              <span>{t("revamp.step5.consent.antimafia")}</span>
            </label>
            <label className="review-check-item">
              <input
                type="checkbox"
                checked={payload.dlgs231Declaration}
                onChange={(e) => {
                  setPayload((prev) => ({ ...prev, dlgs231Declaration: e.target.checked }));
                  markDirty();
                }}
              />
              <span>{t("revamp.step5.consent.dlgs231")}</span>
            </label>
            <label className="review-check-item">
              <input
                type="checkbox"
                checked={payload.model231Adopted}
                onChange={(e) => {
                  setPayload((prev) => ({ ...prev, model231Adopted: e.target.checked }));
                  markDirty();
                }}
              />
              <span>{t("revamp.step5.consent.model231Adopted")}</span>
            </label>
            <label className="review-check-item">
              <input
                type="checkbox"
                checked={payload.fiscalContributionRegularity}
                onChange={(e) => {
                  setPayload((prev) => ({ ...prev, fiscalContributionRegularity: e.target.checked }));
                  markDirty();
                }}
              />
              <span>{t("revamp.step5.consent.fiscalRegularity")}</span>
            </label>
            <label className="review-check-item">
              <input
                type="checkbox"
                checked={payload.gdprComplianceAndDpo}
                onChange={(e) => {
                  setPayload((prev) => ({ ...prev, gdprComplianceAndDpo: e.target.checked }));
                  markDirty();
                }}
              />
              <span>{t("revamp.step5.consent.gdprDpo")}</span>
            </label>
          </>
        ) : null}

        <h3 className="revamp-step-subtitle"><KeyRound className="h-4 w-4" /> {t("revamp.step5.otp.title")}</h3>
        <label className={`floating-field ${payload.otpCode ? "has-value" : ""}`}>
          <input
            className="floating-input auth-input"
            inputMode="numeric"
            maxLength={6}
            value={payload.otpCode}
            onChange={(e) => {
              const onlyDigits = e.target.value.replace(/\D/g, "").slice(0, 6);
              setPayload((prev) => ({ ...prev, otpCode: onlyDigits, otpVerified: false, otpVerifiedAt: null }));
              markDirty();
            }}
            placeholder=" "
          />
          <span className="floating-field-label">{t("revamp.step5.otp.codeLabel")}</span>
        </label>
        <div className="revamp-step-actions">
          <button type="button" className="home-btn home-btn-secondary" onClick={() => void sendOtp()} disabled={otpBusy}>
            {t("revamp.step5.otp.send")}
          </button>
          <button type="button" className="home-btn home-btn-secondary" onClick={() => void verifyOtp()} disabled={otpBusy}>
            {t("revamp.step5.otp.verify")}
          </button>
          <span className={payload.otpVerified ? "subtle" : "error"}>
            {payload.otpVerified ? t("revamp.step5.otp.statusVerified") : t("revamp.step5.otp.statusNotVerified")}
          </span>
        </div>
        {otpHint ? <p className="subtle">{otpHint}</p> : null}
        {otpError ? <p className="error">{otpError}</p> : null}

        <label className="review-check-item">
          <input
            type="checkbox"
            checked={payload.marketingConsent}
            onChange={(e) => {
              setPayload((prev) => ({ ...prev, marketingConsent: e.target.checked }));
              markDirty();
            }}
          />
          <span>{t("revamp.step5.marketingConsent")}</span>
        </label>

        <div className="revamp-step-actions">
          <Link className="home-btn home-btn-secondary" to={`/application/${applicationId}/step/4`}>
            {t("revamp.step5.backToStep4")}
          </Link>
          <Link className="home-btn home-btn-secondary" to={`/application/${applicationId}/recap`}>
            {t("revamp.step5.goToRecap")}
          </Link>
          <button type="submit" className="home-btn home-btn-primary" disabled={saveState === "saving"}>
            <Save className="h-4 w-4" />
            <span>{saveState === "saving" ? t("revamp.step5.saving") : t("revamp.step5.saveSection")}</span>
          </button>
          <button type="button" className="home-btn home-btn-secondary" disabled={!completed} title={!completed ? t("revamp.step5.readyDisabledTitle") : t("revamp.step5.readyEnabledTitle")}>
            {t("revamp.step5.readyToSubmit")}
          </button>
        </div>
      </form>
    </section>
  );
}
