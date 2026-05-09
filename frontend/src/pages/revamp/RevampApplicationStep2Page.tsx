import { FormEvent, useEffect, useMemo, useState } from "react";
import { BookOpenCheck, BriefcaseBusiness, Building2, Handshake, Info, Layers3, Save, UserRoundCheck, Wrench } from "lucide-react";
import { Link, Navigate, useParams } from "react-router-dom";
import {
  getRevampApplicationSections,
  getRevampApplicationSummary,
  saveRevampApplicationSection,
  type RevampApplicationSummary,
  type RevampRegistryType
} from "../../api/revampApplicationApi";
import { HttpError } from "../../api/http";
import { useAuth } from "../../auth/AuthContext";
import { useI18n } from "../../i18n/I18nContext";
import { ATECO_FORMAT_ERROR, isValidAtecoCode, normalizeAtecoCode } from "../../utils/atecoValidation";
import { saveRevampApplicationSession } from "../../utils/revampApplicationSession";
import { resolveStepGuardRedirect } from "./revampFlow";
import { useFcrEditMode } from "../../hooks/useFcrEditMode";
import { FcrSubmitBar } from "../../components/supplier/FcrSubmitBar";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";
type FieldErrors = Record<string, string>;

type AlboASection2 = {
  professionalType: string;
  atecoCode: string;
  secondaryProfessionalTypes: string[];
};

type AlboBSection2 = {
  employeeRange: string;
  revenueBand: string;
  atecoPrimary: string;
  atecoSecondary: string[];
  operatingRegions: Array<{
    region: string;
    provincesCsv: string;
  }>;
  regionalTrainingAccreditation: {
    isAccredited: boolean;
    regionsCsv: string;
    accreditationNumber: string;
  };
  thirdSectorType: string;
  runtsNumber: string;
};

const emptyA: AlboASection2 = {
  professionalType: "",
  atecoCode: "",
  secondaryProfessionalTypes: []
};

const emptyB: AlboBSection2 = {
  employeeRange: "",
  revenueBand: "",
  atecoPrimary: "",
  atecoSecondary: [""],
  operatingRegions: [{ region: "", provincesCsv: "" }],
  regionalTrainingAccreditation: {
    isAccredited: false,
    regionsCsv: "",
    accreditationNumber: ""
  },
  thirdSectorType: "",
  runtsNumber: ""
};

const PROFESSIONAL_TYPE_OPTIONS = [
  {
    value: "DOCENTE_FORMATORE",
    labelKey: "revamp.step2.option.profType.docente",
    hint: "Didattica, aula, e-learning, progettazione contenuti.",
    icon: BookOpenCheck
  },
  {
    value: "CONSULENTE",
    labelKey: "revamp.step2.option.profType.consulente",
    hint: "Consulenza specialistica tecnica, legale, fiscale o organizzativa.",
    icon: BriefcaseBusiness
  },
  {
    value: "COACH",
    labelKey: "revamp.step2.option.profType.coach",
    hint: "Percorsi di coaching individuale o di team.",
    icon: UserRoundCheck
  },
  {
    value: "MENTOR",
    labelKey: "revamp.step2.option.profType.mentor",
    hint: "Affiancamento e mentoring su competenze e carriera.",
    icon: Handshake
  },
  {
    value: "ALTRO",
    labelKey: "revamp.step2.option.profType.altro",
    hint: "Profilo non standard: richiede indicazione ATECO.",
    icon: Wrench
  }
] as const;

const EMPLOYEE_RANGE_OPTIONS = [
  { value: "SOLO_TITOLARE", labelKey: "revamp.step2.option.employeeRange.solo", hint: "Micro impresa individuale" },
  { value: "2_5", label: "2 - 5", hint: "Piccola struttura" },
  { value: "6_15", label: "6 - 15", hint: "Team operativo esteso" },
  { value: "16_50", label: "16 - 50", hint: "PMI consolidata" },
  { value: "51_250", label: "51 - 250", hint: "Organizzazione articolata" },
  { value: "OVER_250", labelKey: "revamp.step2.option.employeeRange.over250", hint: "Grande impresa" }
] as const;

function ErrorTooltip({ message }: { message: string }) {
  return (
    <span className="ateco-error-tooltip-wrap" tabIndex={0}>
      <Info className="h-4 w-4" aria-hidden="true" />
      <span className="ateco-error-tooltip" role="tooltip">{message}</span>
    </span>
  );
}

function parsePayload<T>(payloadJson?: string | null): T | null {
  if (!payloadJson) return null;
  try {
    return JSON.parse(payloadJson) as T;
  } catch {
    return null;
  }
}

export function RevampApplicationStep2Page() {
  const { applicationId } = useParams();
  const { auth } = useAuth();
  const { t } = useI18n();
  const fcr = useFcrEditMode();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [summary, setSummary] = useState<RevampApplicationSummary | null>(null);
  const [alboA, setAlboA] = useState<AlboASection2>(emptyA);
  const [alboB, setAlboB] = useState<AlboBSection2>(emptyB);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [guardRedirect, setGuardRedirect] = useState<string | null>(null);

  const registryType = summary?.registryType;
  const saveLabel = useMemo(() => {
    if (saveState === "saving") return t("revamp.step.common.saveState.saving");
    if (saveState === "saved") return lastSavedAt ? t("revamp.step.common.saveState.savedAt", { time: lastSavedAt }) : t("revamp.step.common.saveState.saved");
    if (saveState === "error") return t("revamp.step.common.saveState.error");
    if (saveState === "dirty") return t("revamp.step.common.saveState.dirty");
    return t("revamp.step.common.saveState.idle");
  }, [lastSavedAt, saveState, t]);

  function locked(key: string) {
    return fcr.active && fcr.isLocked(key) ? " fcr-locked" : "";
  }

  function readOnlyGroup(key: string) {
    return fcr.active && fcr.isLocked(key);
  }

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
          resumePath: `/application/${applicationId}/step/2`
        });

        const sections = await getRevampApplicationSections(applicationId, auth.token);
        const redirect = resolveStepGuardRedirect(applicationId, appSummary.registryType, sections, "step2");
        setGuardRedirect(redirect);
        const step2 = sections.find((section) => section.sectionKey === "S2");

        if (appSummary.registryType === "ALBO_A") {
          const parsed = parsePayload<AlboASection2>(step2?.payloadJson);
          if (parsed) {
            setAlboA({
              professionalType: parsed.professionalType ?? "",
              atecoCode: parsed.atecoCode ?? "",
              secondaryProfessionalTypes: Array.isArray(parsed.secondaryProfessionalTypes)
                ? parsed.secondaryProfessionalTypes.filter((value): value is string => typeof value === "string")
                : []
            });
          }
        } else if (appSummary.registryType === "ALBO_B") {
          const parsed = parsePayload<AlboBSection2>(step2?.payloadJson);
          if (parsed) {
            setAlboB({
              employeeRange: parsed.employeeRange ?? "",
              revenueBand: parsed.revenueBand ?? "",
              atecoPrimary: parsed.atecoPrimary ?? "",
              atecoSecondary: Array.isArray(parsed.atecoSecondary) && parsed.atecoSecondary.length > 0
                ? parsed.atecoSecondary.filter((value): value is string => typeof value === "string")
                : [""],
              operatingRegions: Array.isArray(parsed.operatingRegions)
                ? parsed.operatingRegions.filter((item): item is { region: string; provincesCsv: string } => typeof item?.region === "string")
                : [{
                    region: typeof parsed.operatingRegions === "string" ? parsed.operatingRegions : "",
                    provincesCsv: ""
                  }],
              regionalTrainingAccreditation: {
                isAccredited: Boolean(parsed.regionalTrainingAccreditation?.isAccredited),
                regionsCsv: parsed.regionalTrainingAccreditation?.regionsCsv ?? "",
                accreditationNumber: parsed.regionalTrainingAccreditation?.accreditationNumber ?? ""
              },
              thirdSectorType: parsed.thirdSectorType ?? "",
              runtsNumber: parsed.runtsNumber ?? ""
            });
          }
        }

        if (step2?.updatedAt) {
          setLastSavedAt(new Date(step2.updatedAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }));
          setSaveState("saved");
        } else {
          setSaveState("idle");
        }
      } catch (error) {
        const message = error instanceof HttpError ? error.message : t("revamp.step.common.loadErrorFallback");
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

  function selectProfessionalType(value: string) {
    setAlboA((prev) => ({
      ...prev,
      professionalType: value,
      secondaryProfessionalTypes: prev.secondaryProfessionalTypes.filter((item) => item !== value)
    }));
    setErrors((prev) => ({ ...prev, professionalType: "" }));
    markDirty();
  }

  function toggleSecondaryProfessionalType(value: string) {
    setAlboA((prev) => {
      if (prev.professionalType === value) return prev;
      const exists = prev.secondaryProfessionalTypes.includes(value);
      const secondaryProfessionalTypes = exists
        ? prev.secondaryProfessionalTypes.filter((item) => item !== value)
        : [...prev.secondaryProfessionalTypes, value];
      return { ...prev, secondaryProfessionalTypes };
    });
    markDirty();
  }

  function selectEmployeeRange(value: string) {
    setAlboB((prev) => ({ ...prev, employeeRange: value }));
    setErrors((prev) => ({ ...prev, employeeRange: "" }));
    markDirty();
  }

  function validate(type: RevampRegistryType): FieldErrors {
    if (type === "ALBO_A") {
      const next: FieldErrors = {};
      if (!alboA.professionalType.trim()) next.professionalType = t("revamp.step2.error.professionalTypeRequired");
      if (alboA.professionalType === "ALTRO" && !alboA.atecoCode.trim()) next.atecoCode = t("revamp.step2.error.atecoRequiredForOther");
      else if (alboA.atecoCode.trim() && !isValidAtecoCode(alboA.atecoCode)) next.atecoCode = ATECO_FORMAT_ERROR;
      return next;
    }

    const next: FieldErrors = {};
    if (!alboB.employeeRange.trim()) next.employeeRange = t("revamp.step2.error.employeeRangeRequired");
    if (!alboB.revenueBand.trim()) next.revenueBand = "Fascia fatturato obbligatoria.";
    if (!alboB.atecoPrimary.trim()) next.atecoPrimary = t("revamp.step2.error.atecoPrimaryRequired");
    else if (!isValidAtecoCode(alboB.atecoPrimary)) next.atecoPrimary = ATECO_FORMAT_ERROR;
    const validRegions = alboB.operatingRegions.filter((item) => item.region.trim());
    if (validRegions.length === 0) next.operatingRegions = t("revamp.step2.error.operatingRegionsRequired");
    const nonBlankSecondary = alboB.atecoSecondary.map((item) => item.trim()).filter(Boolean);
    if (nonBlankSecondary.length > 3) next.atecoSecondary = "Massimo 3 codici ATECO secondari.";
    alboB.atecoSecondary.forEach((value, index) => {
      if (value.trim() && !isValidAtecoCode(value)) next[`atecoSecondary_${index}`] = ATECO_FORMAT_ERROR;
    });
    return next;
  }

  function buildPayload(type: RevampRegistryType) {
    return type === "ALBO_A"
      ? { ...alboA, atecoCode: normalizeAtecoCode(alboA.atecoCode) }
      : {
          ...alboB,
          atecoPrimary: normalizeAtecoCode(alboB.atecoPrimary),
          atecoSecondary: alboB.atecoSecondary.map(normalizeAtecoCode).filter(Boolean).slice(0, 3),
          operatingRegions: alboB.operatingRegions
            .map((item) => ({ region: item.region.trim(), provincesCsv: item.provincesCsv.trim() }))
            .filter((item) => item.region),
          thirdSectorType: alboB.thirdSectorType.trim(),
          runtsNumber: alboB.runtsNumber.trim()
        };
  }

  async function saveSectionProgrammatic(): Promise<void> {
    if (!applicationId || !auth?.token || !registryType) return;
    const validationErrors = validate(registryType);
    setErrors(validationErrors);
    const completed = Object.keys(validationErrors).length === 0;
    const payload = buildPayload(registryType);
    setSaveState("saving");
    try {
      const saved = await saveRevampApplicationSection(applicationId, "S2", JSON.stringify(payload), completed, auth.token);
      setLastSavedAt(new Date(saved.updatedAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }));
      setSaveState("saved");
    } catch (e) {
      setSaveState("error");
      throw e;
    }
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (!applicationId || !auth?.token || !registryType) return;

    const validationErrors = validate(registryType);
    setErrors(validationErrors);
    const completed = Object.keys(validationErrors).length === 0;
    const payload = buildPayload(registryType);

    setSaveState("saving");
    try {
      const saved = await saveRevampApplicationSection(
        applicationId,
        "S2",
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
          <h2>{t("revamp.step2.loading")}</h2>
        </div>
      </section>
    );
  }

  if (loadError || !registryType) {
    return (
      <section className="stack">
        <div className="panel">
          <h2>{t("revamp.step.common.loadFailedTitle")}</h2>
          <p className="error">{loadError ?? t("revamp.common.applicationNotFound")}</p>
          <Link className="home-inline-link home-inline-link-supplier" to="/supplier">
            {t("revamp.common.backToSupplier")}
          </Link>
        </div>
      </section>
    );
  }

  if (guardRedirect && guardRedirect !== `/application/${applicationId}/step/2`) {
    return <Navigate to={guardRedirect} replace />;
  }

  return (
    <section className="stack">
      <div className="panel revamp-step-header">
        <h2>{registryType === "ALBO_A" ? t("revamp.step2.title.alboA") : t("revamp.step2.title.alboB")}</h2>
        <p className="subtle">
          {fcr.active
            ? `Candidatura ${applicationId} - Richiesta di modifica: ${saveLabel}`
            : t("revamp.step.common.subtitle", { id: applicationId, state: saveLabel })}
        </p>
      </div>

      <form className="panel stack" onSubmit={onSave}>
        {registryType === "ALBO_A" ? (
          <>
            <h3 className="revamp-step-subtitle"><Layers3 className="h-4 w-4" /> {t("revamp.step2.alboA.sectionTitle")}</h3>
            <p className="subtle">Seleziona la tipologia professionale che rappresenta meglio la candidatura.</p>
            <div className={`revamp-choice-grid${locked("tipo_prof")}`}>
              {PROFESSIONAL_TYPE_OPTIONS.map((option) => {
                const selected = alboA.professionalType === option.value;
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`revamp-choice-card ${selected ? "selected" : ""}`}
                    disabled={readOnlyGroup("tipo_prof")}
                    onClick={() => selectProfessionalType(option.value)}
                  >
                    <div className="revamp-choice-card-head">
                      <Icon className="h-4 w-4" />
                      <strong>{t(option.labelKey)}</strong>
                    </div>
                    <p className="subtle">{option.hint}</p>
                  </button>
                );
              })}
            </div>

            <div className={`grid-form${locked("ateco")}`}>
              <label className={`floating-field ${alboA.atecoCode ? "has-value" : ""}`}>
                <input
                  className="floating-input auth-input"
                  value={alboA.atecoCode}
                  disabled={readOnlyGroup("ateco")}
                  onChange={(e) => {
                    const value = e.target.value;
                    setAlboA((prev) => ({ ...prev, atecoCode: value }));
                    setErrors((prev) => ({
                      ...prev,
                      atecoCode: value.trim() && !isValidAtecoCode(value) ? ATECO_FORMAT_ERROR : ""
                    }));
                    markDirty();
                  }}
                  placeholder=" "
                />
                <span className="floating-field-label">
                  {t("revamp.step2.field.atecoCode", { required: alboA.professionalType === "ALTRO" ? "*" : t("revamp.step2.optional") })}
                  {errors.atecoCode === ATECO_FORMAT_ERROR ? <ErrorTooltip message={errors.atecoCode} /> : null}
                </span>
              </label>
            </div>

            <div className={`home-step-card${locked("comp_secondarie")}`}>
              <div className="home-step-head">
                <span className="home-step-index">2</span>
                <h4>{t("revamp.step2.field.secondaryProfessionalTypesOptional")}</h4>
              </div>
              <div className="grid-form" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                {PROFESSIONAL_TYPE_OPTIONS.map((option) => {
                  if (option.value === alboA.professionalType) return null;
                  const checked = alboA.secondaryProfessionalTypes.includes(option.value);
                  return (
                    <label key={option.value} className="review-check-item">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={readOnlyGroup("comp_secondarie")}
                        onChange={() => toggleSecondaryProfessionalType(option.value)}
                      />
                      <span>{t(option.labelKey)}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {errors.professionalType ? <p className="error">{errors.professionalType}</p> : null}
            {errors.atecoCode && errors.atecoCode !== ATECO_FORMAT_ERROR ? <p className="error">{errors.atecoCode}</p> : null}
          </>
        ) : (
          <>
            <h3 className="revamp-step-subtitle"><Building2 className="h-4 w-4" /> {t("revamp.step2.alboB.sectionTitle")}</h3>
            <p className="subtle">Seleziona la fascia dimensionale dell'azienda.</p>
            <div className={`revamp-choice-grid revamp-choice-grid-compact${locked("dimensione")}`}>
              {EMPLOYEE_RANGE_OPTIONS.map((option) => {
                const label = "labelKey" in option ? t(option.labelKey) : option.label;
                const selected = alboB.employeeRange === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`revamp-choice-card ${selected ? "selected" : ""}`}
                    disabled={readOnlyGroup("dimensione")}
                    onClick={() => selectEmployeeRange(option.value)}
                  >
                    <div className="revamp-choice-card-head">
                      <strong>{label}</strong>
                    </div>
                    <p className="subtle">{option.hint}</p>
                  </button>
                );
              })}
            </div>
            <div className={`grid-form${locked("dimensione")}`}>
              <label className="floating-field has-value">
                <select
                  className="floating-input auth-input"
                  value={alboB.employeeRange}
                  disabled={readOnlyGroup("dimensione")}
                  onChange={(e) => { selectEmployeeRange(e.target.value); }}
                >
                  <option value="">{t("revamp.step2.option.selectEmployeeRange")}</option>
                  <option value="SOLO_TITOLARE">{t("revamp.step2.option.employeeRange.solo")}</option>
                  <option value="2_5">2 - 5</option>
                  <option value="6_15">6 - 15</option>
                  <option value="16_50">16 - 50</option>
                  <option value="51_250">51 - 250</option>
                  <option value="OVER_250">{t("revamp.step2.option.employeeRange.over250")}</option>
                </select>
                <span className="floating-field-label">{t("revamp.step2.field.employeeRange")}</span>
              </label>
              <label className={`floating-field ${alboB.atecoPrimary ? "has-value" : ""}`}>
                <input
                  className="floating-input auth-input"
                  value={alboB.atecoPrimary}
                  disabled={readOnlyGroup("dimensione")}
                  onChange={(e) => {
                    const value = e.target.value;
                    setAlboB((prev) => ({ ...prev, atecoPrimary: value }));
                    setErrors((prev) => ({
                      ...prev,
                      atecoPrimary: value.trim() && !isValidAtecoCode(value) ? ATECO_FORMAT_ERROR : ""
                    }));
                    markDirty();
                  }}
                  placeholder=" "
                />
                <span className="floating-field-label">
                  {t("revamp.step2.field.atecoPrimary")}
                  {errors.atecoPrimary === ATECO_FORMAT_ERROR ? <ErrorTooltip message={errors.atecoPrimary} /> : null}
                </span>
              </label>
              <label className={`floating-field ${alboB.revenueBand ? "has-value" : ""}`}>
                <input
                  className="floating-input auth-input"
                  value={alboB.revenueBand}
                  disabled={readOnlyGroup("dimensione")}
                  onChange={(e) => {
                    setAlboB((prev) => ({ ...prev, revenueBand: e.target.value }));
                    markDirty();
                  }}
                  placeholder=" "
                />
                <span className="floating-field-label">Fascia fatturato *</span>
              </label>
            </div>
            {errors.employeeRange ? <p className="error">{errors.employeeRange}</p> : null}
            {errors.revenueBand ? <p className="error">{errors.revenueBand}</p> : null}
            {errors.atecoPrimary && errors.atecoPrimary !== ATECO_FORMAT_ERROR ? <p className="error">{errors.atecoPrimary}</p> : null}

            <div className={`home-step-card${locked("ateco_b")}`}>
              <div className="home-step-head">
                <span className="home-step-index">A</span>
                <h4>ATECO secondari (max 3)</h4>
              </div>
              <div className="stack">
                {alboB.atecoSecondary.map((value, index) => (
                  <div key={`ateco-secondary-${index}`} className="revamp-step-actions">
                    <label className={`floating-field ${value ? "has-value" : ""}`} style={{ flex: 1 }}>
                      <input
                        className="floating-input auth-input"
                        value={value}
                        disabled={readOnlyGroup("ateco_b")}
                        onChange={(e) => {
                          const value = e.target.value;
                          const next = [...alboB.atecoSecondary];
                          next[index] = value;
                          setAlboB((prev) => ({ ...prev, atecoSecondary: next }));
                          setErrors((prev) => ({
                            ...prev,
                            [`atecoSecondary_${index}`]: value.trim() && !isValidAtecoCode(value) ? ATECO_FORMAT_ERROR : ""
                          }));
                          markDirty();
                        }}
                        placeholder=" "
                      />
                      <span className="floating-field-label">
                        Codice ATECO secondario
                        {errors[`atecoSecondary_${index}`] === ATECO_FORMAT_ERROR ? <ErrorTooltip message={errors[`atecoSecondary_${index}`]} /> : null}
                      </span>
                    </label>
                    <button
                      type="button"
                      className="home-btn home-btn-secondary"
                      disabled={readOnlyGroup("ateco_b")}
                      onClick={() => {
                        if (alboB.atecoSecondary.length <= 1) return;
                        setAlboB((prev) => ({ ...prev, atecoSecondary: prev.atecoSecondary.filter((_, idx) => idx !== index) }));
                        markDirty();
                      }}
                    >
                      Rimuovi
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="home-btn home-btn-secondary"
                  disabled={readOnlyGroup("ateco_b") || alboB.atecoSecondary.length >= 3}
                  onClick={() => {
                    setAlboB((prev) => ({ ...prev, atecoSecondary: [...prev.atecoSecondary, ""] }));
                    markDirty();
                  }}
                >
                  + Aggiungi ATECO secondario
                </button>
              </div>
            </div>
            {errors.atecoSecondary ? <p className="error">{errors.atecoSecondary}</p> : null}

            <div className={`home-step-card${locked("regioni_op")}`}>
              <div className="home-step-head">
                <span className="home-step-index">R</span>
                <h4>Regioni operative *</h4>
              </div>
              <div className="stack">
                {alboB.operatingRegions.map((item, index) => (
                  <div key={`region-${index}`} className="grid-form">
                    <label className={`floating-field ${item.region ? "has-value" : ""}`}>
                      <input
                        className="floating-input auth-input"
                        value={item.region}
                        disabled={readOnlyGroup("regioni_op")}
                        onChange={(e) => {
                          const next = [...alboB.operatingRegions];
                          next[index] = { ...next[index], region: e.target.value };
                          setAlboB((prev) => ({ ...prev, operatingRegions: next }));
                          markDirty();
                        }}
                        placeholder=" "
                      />
                      <span className="floating-field-label">Regione</span>
                    </label>
                    <label className={`floating-field ${item.provincesCsv ? "has-value" : ""}`}>
                      <input
                        className="floating-input auth-input"
                        value={item.provincesCsv}
                        disabled={readOnlyGroup("regioni_op")}
                        onChange={(e) => {
                          const next = [...alboB.operatingRegions];
                          next[index] = { ...next[index], provincesCsv: e.target.value };
                          setAlboB((prev) => ({ ...prev, operatingRegions: next }));
                          markDirty();
                        }}
                        placeholder=" "
                      />
                      <span className="floating-field-label">Province (CSV)</span>
                    </label>
                    <button
                      type="button"
                      className="home-btn home-btn-secondary"
                      disabled={readOnlyGroup("regioni_op")}
                      onClick={() => {
                        if (alboB.operatingRegions.length <= 1) return;
                        setAlboB((prev) => ({ ...prev, operatingRegions: prev.operatingRegions.filter((_, idx) => idx !== index) }));
                        markDirty();
                      }}
                    >
                      Rimuovi
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="home-btn home-btn-secondary"
                  disabled={readOnlyGroup("regioni_op")}
                  onClick={() => {
                    setAlboB((prev) => ({ ...prev, operatingRegions: [...prev.operatingRegions, { region: "", provincesCsv: "" }] }));
                    markDirty();
                  }}
                >
                  + Aggiungi regione
                </button>
              </div>
            </div>
            {errors.operatingRegions ? <p className="error">{errors.operatingRegions}</p> : null}

            <div className={`home-step-card${locked("acc_formazione")}`}>
              <div className="home-step-head">
                <span className="home-step-index">A</span>
                <h4>Accreditamento formazione regionale</h4>
              </div>
              <label className="review-check-item">
                <input
                  type="checkbox"
                  checked={alboB.regionalTrainingAccreditation.isAccredited}
                  disabled={readOnlyGroup("acc_formazione")}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setAlboB((prev) => ({
                      ...prev,
                      regionalTrainingAccreditation: { ...prev.regionalTrainingAccreditation, isAccredited: checked }
                    }));
                    markDirty();
                  }}
                />
                <span>Accreditata</span>
              </label>
              <div className="grid-form">
                <label className={`floating-field ${alboB.regionalTrainingAccreditation.regionsCsv ? "has-value" : ""}`}>
                  <input
                    className="floating-input auth-input"
                    value={alboB.regionalTrainingAccreditation.regionsCsv}
                    disabled={readOnlyGroup("acc_formazione")}
                    onChange={(e) => {
                      const value = e.target.value;
                      setAlboB((prev) => ({
                        ...prev,
                        regionalTrainingAccreditation: { ...prev.regionalTrainingAccreditation, regionsCsv: value }
                      }));
                      markDirty();
                    }}
                    placeholder=" "
                  />
                  <span className="floating-field-label">Regioni accreditate (CSV)</span>
                </label>
                <label className={`floating-field ${alboB.regionalTrainingAccreditation.accreditationNumber ? "has-value" : ""}`}>
                  <input
                    className="floating-input auth-input"
                    value={alboB.regionalTrainingAccreditation.accreditationNumber}
                    disabled={readOnlyGroup("acc_formazione")}
                    onChange={(e) => {
                      const value = e.target.value;
                      setAlboB((prev) => ({
                        ...prev,
                        regionalTrainingAccreditation: { ...prev.regionalTrainingAccreditation, accreditationNumber: value }
                      }));
                      markDirty();
                    }}
                    placeholder=" "
                  />
                  <span className="floating-field-label">Numero accreditamento</span>
                </label>
              </div>
            </div>

            <div className={`grid-form${locked("terzo_settore")}`}>
              <label className={`floating-field ${alboB.thirdSectorType ? "has-value" : ""}`}>
                <input
                  className="floating-input auth-input"
                  value={alboB.thirdSectorType}
                  disabled={readOnlyGroup("terzo_settore")}
                  onChange={(e) => {
                    setAlboB((prev) => ({ ...prev, thirdSectorType: e.target.value }));
                    markDirty();
                  }}
                  placeholder=" "
                />
                <span className="floating-field-label">Tipologia terzo settore</span>
              </label>
              <label className={`floating-field ${alboB.runtsNumber ? "has-value" : ""}`}>
                <input
                  className="floating-input auth-input"
                  value={alboB.runtsNumber}
                  disabled={readOnlyGroup("terzo_settore")}
                  onChange={(e) => {
                    setAlboB((prev) => ({ ...prev, runtsNumber: e.target.value }));
                    markDirty();
                  }}
                  placeholder=" "
                />
                <span className="floating-field-label">Numero RUNTS</span>
              </label>
            </div>
            {errors.runtsNumber ? <p className="error">{errors.runtsNumber}</p> : null}
          </>
        )}

        <div className="revamp-step-actions">
          {!fcr.active && (
            <Link className="home-btn home-btn-secondary" to={`/application/${applicationId}/step/1`}>
              {t("revamp.step2.backToStep1")}
            </Link>
          )}
          {!fcr.active && (
            <Link className="home-btn home-btn-secondary" to={`/application/${applicationId}/step/3`}>
              {t("revamp.step2.goToStep3")}
            </Link>
          )}
          {!fcr.active && (
            <button type="submit" className="home-btn home-btn-primary" disabled={saveState === "saving"}>
              <Save className="h-4 w-4" />
              <span>{saveState === "saving" ? t("revamp.step.common.saving") : t("revamp.step.common.saveSection")}</span>
            </button>
          )}
        </div>
      </form>
      {auth && <FcrSubmitBar fcr={fcr} token={auth.token!} onSectionSaved={saveSectionProgrammatic} />}
    </section>
  );
}
