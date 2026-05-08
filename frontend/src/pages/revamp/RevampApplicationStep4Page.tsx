import { FormEvent, useEffect, useMemo, useState } from "react";
import { Award, Building2, Save, UserCheck } from "lucide-react";
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
import { saveRevampApplicationSession } from "../../utils/revampApplicationSession";
import { resolveStepGuardRedirect } from "./revampFlow";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";
type FieldErrors = Record<string, string>;

type AttachmentInput = {
  documentType: string;
  fileName: string;
  mimeType: string;
  sizeBytes: string;
  storageKey: string;
  expiresAt: string;
};

type Section4AlboA = {
  operationalCapacity: string;
  references: Array<{
    fullName: string;
    organizationRole: string;
    email: string;
    phone: string;
  }>;
  attachments: AttachmentInput[];
};

type Section4AlboB = {
  iso9001: string;
  accreditationSummary: string;
  certificationsNotes: string;
  attachments: AttachmentInput[];
};

const emptyA: Section4AlboA = {
  operationalCapacity: "",
  references: [{ fullName: "", organizationRole: "", email: "", phone: "" }],
  attachments: [{ documentType: "CV", fileName: "", mimeType: "", sizeBytes: "", storageKey: "", expiresAt: "" }]
};

const emptyB: Section4AlboB = {
  iso9001: "",
  accreditationSummary: "",
  certificationsNotes: "",
  attachments: [
    { documentType: "VISURA_CAMERALE", fileName: "", mimeType: "", sizeBytes: "", storageKey: "", expiresAt: "" },
    { documentType: "DURC", fileName: "", mimeType: "", sizeBytes: "", storageKey: "", expiresAt: "" }
  ]
};

function parsePayload<T>(payloadJson?: string | null): T | null {
  if (!payloadJson) return null;
  try {
    return JSON.parse(payloadJson) as T;
  } catch {
    return null;
  }
}

export function RevampApplicationStep4Page() {
  const { applicationId } = useParams();
  const { auth } = useAuth();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [summary, setSummary] = useState<RevampApplicationSummary | null>(null);
  const [alboA, setAlboA] = useState<Section4AlboA>(emptyA);
  const [alboB, setAlboB] = useState<Section4AlboB>(emptyB);
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
          resumePath: `/application/${applicationId}/step/4`
        });
        const sections = await getRevampApplicationSections(applicationId, auth.token);
        const redirect = resolveStepGuardRedirect(applicationId, appSummary.registryType, sections, "step4");
        setGuardRedirect(redirect);
        const step4 = sections.find((section) => section.sectionKey === "S4");

        if (appSummary.registryType === "ALBO_A") {
          const parsed = parsePayload<Section4AlboA>(step4?.payloadJson);
          const legacy = parsePayload<{ referencesSummary?: string }>(step4?.payloadJson);
          if (parsed) {
            setAlboA({
              operationalCapacity: parsed.operationalCapacity ?? "",
              references: parsed.references && parsed.references.length > 0
                ? parsed.references
                : (legacy?.referencesSummary
                    ? [{ fullName: legacy.referencesSummary, organizationRole: "", email: "", phone: "" }]
                    : [{ fullName: "", organizationRole: "", email: "", phone: "" }]),
              attachments: parsed.attachments && parsed.attachments.length > 0
                ? parsed.attachments
                : [{ documentType: "CV", fileName: "", mimeType: "", sizeBytes: "", storageKey: "", expiresAt: "" }]
            });
          }
        } else if (appSummary.registryType === "ALBO_B") {
          const parsed = parsePayload<Section4AlboB>(step4?.payloadJson);
          if (parsed) {
            setAlboB({
              iso9001: parsed.iso9001 ?? "",
              accreditationSummary: parsed.accreditationSummary ?? "",
              certificationsNotes: parsed.certificationsNotes ?? "",
              attachments: parsed.attachments && parsed.attachments.length > 0
                ? parsed.attachments
                : [
                    { documentType: "VISURA_CAMERALE", fileName: "", mimeType: "", sizeBytes: "", storageKey: "", expiresAt: "" },
                    { documentType: "DURC", fileName: "", mimeType: "", sizeBytes: "", storageKey: "", expiresAt: "" }
                  ]
            });
          }
        }

        if (step4?.updatedAt) {
          setLastSavedAt(new Date(step4.updatedAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }));
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

  function validate(type: RevampRegistryType): FieldErrors {
    if (type === "ALBO_A") {
      const next: FieldErrors = {};
      if (!alboA.operationalCapacity.trim()) next.operationalCapacity = t("revamp.step4.error.operationalCapacityRequired");
      if (alboA.references.length > 2) next.references = "Massimo 2 referenze consentite.";
      const hasCvAttachment = alboA.attachments.some(
        (item) => item.documentType === "CV" && item.fileName.trim() && item.storageKey.trim()
      );
      if (!hasCvAttachment) next.attachments = "Almeno un allegato CV con fileName e storageKey e obbligatorio.";
      return next;
    }
    const next: FieldErrors = {};
    if (!alboB.iso9001.trim()) next.iso9001 = t("revamp.step4.error.isoRequired");
    if (!alboB.accreditationSummary.trim()) next.accreditationSummary = t("revamp.step4.error.accreditationsRequired");
    const hasVisura = alboB.attachments.some(
      (item) => item.documentType === "VISURA_CAMERALE" && item.fileName.trim() && item.storageKey.trim()
    );
    const hasDurc = alboB.attachments.some(
      (item) => item.documentType === "DURC" && item.fileName.trim() && item.storageKey.trim()
    );
    if (!hasVisura || !hasDurc) next.attachments = "Visura camerale e DURC con metadata sono obbligatori.";
    const accreditationsDeclared = alboB.iso9001 === "YES" || Boolean(alboB.accreditationSummary.trim());
    if (accreditationsDeclared) {
      const hasCertification = alboB.attachments.some(
        (item) => item.documentType === "CERTIFICATION" && item.fileName.trim() && item.storageKey.trim()
      );
      if (!hasCertification) next.certificationAttachment = "Almeno una certificazione allegata e richiesta.";
    }
    return next;
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (!applicationId || !auth?.token || !registryType) return;
    const validationErrors = validate(registryType);
    setErrors(validationErrors);
    const completed = Object.keys(validationErrors).length === 0;
    const normalizeAttachments = (attachments: AttachmentInput[]) =>
      attachments
        .map((item) => ({
          documentType: item.documentType.trim(),
          fileName: item.fileName.trim(),
          mimeType: item.mimeType.trim(),
          sizeBytes: item.sizeBytes.trim(),
          storageKey: item.storageKey.trim(),
          expiresAt: item.expiresAt.trim()
        }))
        .filter((item) => item.documentType || item.fileName || item.storageKey);
    const payload = registryType === "ALBO_A"
      ? { ...alboA, attachments: normalizeAttachments(alboA.attachments) }
      : { ...alboB, attachments: normalizeAttachments(alboB.attachments) };

    setSaveState("saving");
    try {
      const saved = await saveRevampApplicationSection(
        applicationId,
        "S4",
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
          <h2>{t("revamp.step4.loading")}</h2>
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

  if (guardRedirect && guardRedirect !== `/application/${applicationId}/step/4`) {
    return <Navigate to={guardRedirect} replace />;
  }

  return (
    <section className="stack">
      <div className="panel revamp-step-header">
        <h2>{registryType === "ALBO_A" ? t("revamp.step4.title.alboA") : t("revamp.step4.title.alboB")}</h2>
        <p className="subtle">
          {t("revamp.step.common.subtitle", { id: applicationId, state: saveLabel })}
        </p>
      </div>

      <form className="panel stack" onSubmit={onSave}>
        {registryType === "ALBO_A" ? (
          <>
            <h3 className="revamp-step-subtitle"><UserCheck className="h-4 w-4" /> {t("revamp.step4.alboA.sectionTitle")}</h3>
            <div className="grid-form">
              <label className={`floating-field ${alboA.operationalCapacity ? "has-value" : ""}`}>
                <textarea
                  className="floating-input auth-input"
                  value={alboA.operationalCapacity}
                  onChange={(e) => {
                    setAlboA((prev) => ({ ...prev, operationalCapacity: e.target.value }));
                    markDirty();
                  }}
                  placeholder=" "
                  rows={3}
                />
                <span className="floating-field-label">{t("revamp.step4.field.operationalCapacity")}</span>
              </label>
            </div>
            <div className="home-step-card">
              <div className="home-step-head">
                <span className="home-step-index">R</span>
                <h4>Referenze (opzionali, max 2)</h4>
              </div>
              <div className="stack">
                {alboA.references.map((reference, index) => (
                  <div key={`reference-${index}`} className="grid-form">
                    <label className={`floating-field ${reference.fullName ? "has-value" : ""}`}>
                      <input
                        className="floating-input auth-input"
                        value={reference.fullName}
                        onChange={(e) => {
                          const value = e.target.value;
                          setAlboA((prev) => ({
                            ...prev,
                            references: prev.references.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, fullName: value } : item
                            )
                          }));
                          markDirty();
                        }}
                        placeholder=" "
                      />
                      <span className="floating-field-label">Nome e cognome</span>
                    </label>
                    <label className={`floating-field ${reference.organizationRole ? "has-value" : ""}`}>
                      <input
                        className="floating-input auth-input"
                        value={reference.organizationRole}
                        onChange={(e) => {
                          const value = e.target.value;
                          setAlboA((prev) => ({
                            ...prev,
                            references: prev.references.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, organizationRole: value } : item
                            )
                          }));
                          markDirty();
                        }}
                        placeholder=" "
                      />
                      <span className="floating-field-label">Ruolo / organizzazione</span>
                    </label>
                    <label className={`floating-field ${reference.email ? "has-value" : ""}`}>
                      <input
                        className="floating-input auth-input"
                        type="email"
                        value={reference.email}
                        onChange={(e) => {
                          const value = e.target.value;
                          setAlboA((prev) => ({
                            ...prev,
                            references: prev.references.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, email: value } : item
                            )
                          }));
                          markDirty();
                        }}
                        placeholder=" "
                      />
                      <span className="floating-field-label">Email</span>
                    </label>
                    <label className={`floating-field ${reference.phone ? "has-value" : ""}`}>
                      <input
                        className="floating-input auth-input"
                        value={reference.phone}
                        onChange={(e) => {
                          const value = e.target.value;
                          setAlboA((prev) => ({
                            ...prev,
                            references: prev.references.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, phone: value } : item
                            )
                          }));
                          markDirty();
                        }}
                        placeholder=" "
                      />
                      <span className="floating-field-label">Telefono</span>
                    </label>
                    <button
                      type="button"
                      className="home-btn home-btn-secondary"
                      onClick={() => {
                        setAlboA((prev) => ({
                          ...prev,
                          references: prev.references.length > 1 ? prev.references.filter((_, itemIndex) => itemIndex !== index) : prev.references
                        }));
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
                  disabled={alboA.references.length >= 2}
                  onClick={() => {
                    setAlboA((prev) => ({
                      ...prev,
                      references: [...prev.references, { fullName: "", organizationRole: "", email: "", phone: "" }]
                    }));
                    markDirty();
                  }}
                >
                  + Aggiungi referenza
                </button>
              </div>
            </div>
            <div className="home-step-card">
              <div className="home-step-head">
                <span className="home-step-index">D</span>
                <h4>Allegati (CV obbligatorio)</h4>
              </div>
              <div className="stack">
                {alboA.attachments.map((attachment, index) => (
                  <div key={`alboA-attachment-${index}`} className="grid-form">
                    <label className="floating-field has-value">
                      <select
                        className="floating-input auth-input"
                        value={attachment.documentType}
                        onChange={(e) => {
                          const value = e.target.value;
                          setAlboA((prev) => ({
                            ...prev,
                            attachments: prev.attachments.map((item, itemIndex) => itemIndex === index ? { ...item, documentType: value } : item)
                          }));
                          markDirty();
                        }}
                      >
                        <option value="CV">CV</option>
                        <option value="CERTIFICATION">Certificazione</option>
                        <option value="OTHER">Altro</option>
                      </select>
                      <span className="floating-field-label">Tipo documento</span>
                    </label>
                    <label className={`floating-field ${attachment.fileName ? "has-value" : ""}`}>
                      <input
                        className="floating-input auth-input"
                        value={attachment.fileName}
                        onChange={(e) => {
                          const value = e.target.value;
                          setAlboA((prev) => ({
                            ...prev,
                            attachments: prev.attachments.map((item, itemIndex) => itemIndex === index ? { ...item, fileName: value } : item)
                          }));
                          markDirty();
                        }}
                        placeholder=" "
                      />
                      <span className="floating-field-label">fileName *</span>
                    </label>
                    <label className={`floating-field ${attachment.storageKey ? "has-value" : ""}`}>
                      <input
                        className="floating-input auth-input"
                        value={attachment.storageKey}
                        onChange={(e) => {
                          const value = e.target.value;
                          setAlboA((prev) => ({
                            ...prev,
                            attachments: prev.attachments.map((item, itemIndex) => itemIndex === index ? { ...item, storageKey: value } : item)
                          }));
                          markDirty();
                        }}
                        placeholder=" "
                      />
                      <span className="floating-field-label">storageKey *</span>
                    </label>
                    <button
                      type="button"
                      className="home-btn home-btn-secondary"
                      onClick={() => {
                        setAlboA((prev) => ({
                          ...prev,
                          attachments: prev.attachments.length > 1 ? prev.attachments.filter((_, i) => i !== index) : prev.attachments
                        }));
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
                  onClick={() => {
                    setAlboA((prev) => ({
                      ...prev,
                      attachments: [...prev.attachments, { documentType: "OTHER", fileName: "", mimeType: "", sizeBytes: "", storageKey: "", expiresAt: "" }]
                    }));
                    markDirty();
                  }}
                >
                  + Aggiungi allegato
                </button>
              </div>
            </div>
            {errors.operationalCapacity ? <p className="error">{errors.operationalCapacity}</p> : null}
            {errors.references ? <p className="error">{errors.references}</p> : null}
            {errors.attachments ? <p className="error">{errors.attachments}</p> : null}
          </>
        ) : (
          <>
            <h3 className="revamp-step-subtitle"><Award className="h-4 w-4" /> {t("revamp.step4.alboB.sectionTitle")}</h3>
            <div className="grid-form">
              <label className="floating-field has-value">
                <select
                  className="floating-input auth-input"
                  value={alboB.iso9001}
                  onChange={(e) => {
                    setAlboB((prev) => ({ ...prev, iso9001: e.target.value }));
                    markDirty();
                  }}
                >
                  <option value="">{t("revamp.step4.option.isoPrompt")}</option>
                  <option value="YES">{t("revamp.step4.option.yes")}</option>
                  <option value="NO">{t("revamp.step4.option.no")}</option>
                </select>
                <span className="floating-field-label">{t("revamp.step4.field.iso9001")}</span>
              </label>
              <label className={`floating-field ${alboB.accreditationSummary ? "has-value" : ""}`}>
                <textarea
                  className="floating-input auth-input"
                  value={alboB.accreditationSummary}
                  onChange={(e) => {
                    setAlboB((prev) => ({ ...prev, accreditationSummary: e.target.value }));
                    markDirty();
                  }}
                  placeholder=" "
                  rows={3}
                />
                <span className="floating-field-label">{t("revamp.step4.field.accreditationSummary")}</span>
              </label>
              <label className={`floating-field ${alboB.certificationsNotes ? "has-value" : ""}`}>
                <textarea
                  className="floating-input auth-input"
                  value={alboB.certificationsNotes}
                  onChange={(e) => {
                    setAlboB((prev) => ({ ...prev, certificationsNotes: e.target.value }));
                    markDirty();
                  }}
                  placeholder=" "
                  rows={2}
                />
                <span className="floating-field-label">{t("revamp.step4.field.certificationNotes")}</span>
              </label>
            </div>
            <div className="home-step-card">
              <div className="home-step-head">
                <span className="home-step-index">D</span>
                <h4>Allegati (Visura + DURC obbligatori)</h4>
              </div>
              <div className="stack">
                {alboB.attachments.map((attachment, index) => (
                  <div key={`alboB-attachment-${index}`} className="grid-form">
                    <label className="floating-field has-value">
                      <select
                        className="floating-input auth-input"
                        value={attachment.documentType}
                        onChange={(e) => {
                          const value = e.target.value;
                          setAlboB((prev) => ({
                            ...prev,
                            attachments: prev.attachments.map((item, itemIndex) => itemIndex === index ? { ...item, documentType: value } : item)
                          }));
                          markDirty();
                        }}
                      >
                        <option value="VISURA_CAMERALE">Visura camerale</option>
                        <option value="DURC">DURC</option>
                        <option value="COMPANY_PROFILE">Company profile</option>
                        <option value="CERTIFICATION">Certificazione</option>
                        <option value="OTHER">Altro</option>
                      </select>
                      <span className="floating-field-label">Tipo documento</span>
                    </label>
                    <label className={`floating-field ${attachment.fileName ? "has-value" : ""}`}>
                      <input
                        className="floating-input auth-input"
                        value={attachment.fileName}
                        onChange={(e) => {
                          const value = e.target.value;
                          setAlboB((prev) => ({
                            ...prev,
                            attachments: prev.attachments.map((item, itemIndex) => itemIndex === index ? { ...item, fileName: value } : item)
                          }));
                          markDirty();
                        }}
                        placeholder=" "
                      />
                      <span className="floating-field-label">fileName *</span>
                    </label>
                    <label className={`floating-field ${attachment.storageKey ? "has-value" : ""}`}>
                      <input
                        className="floating-input auth-input"
                        value={attachment.storageKey}
                        onChange={(e) => {
                          const value = e.target.value;
                          setAlboB((prev) => ({
                            ...prev,
                            attachments: prev.attachments.map((item, itemIndex) => itemIndex === index ? { ...item, storageKey: value } : item)
                          }));
                          markDirty();
                        }}
                        placeholder=" "
                      />
                      <span className="floating-field-label">storageKey *</span>
                    </label>
                    <button
                      type="button"
                      className="home-btn home-btn-secondary"
                      onClick={() => {
                        setAlboB((prev) => ({
                          ...prev,
                          attachments: prev.attachments.length > 1 ? prev.attachments.filter((_, i) => i !== index) : prev.attachments
                        }));
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
                  onClick={() => {
                    setAlboB((prev) => ({
                      ...prev,
                      attachments: [...prev.attachments, { documentType: "OTHER", fileName: "", mimeType: "", sizeBytes: "", storageKey: "", expiresAt: "" }]
                    }));
                    markDirty();
                  }}
                >
                  + Aggiungi allegato
                </button>
              </div>
            </div>
            {errors.iso9001 ? <p className="error">{errors.iso9001}</p> : null}
            {errors.accreditationSummary ? <p className="error">{errors.accreditationSummary}</p> : null}
            {errors.attachments ? <p className="error">{errors.attachments}</p> : null}
            {errors.certificationAttachment ? <p className="error">{errors.certificationAttachment}</p> : null}
          </>
        )}

        <div className="revamp-step-actions">
          <Link className="home-btn home-btn-secondary" to={`/application/${applicationId}/step/3`}>
            {t("revamp.step4.backToStep3")}
          </Link>
          <Link className="home-btn home-btn-secondary" to={`/application/${applicationId}/step/5`}>
            {t("revamp.step4.goToStep5")}
          </Link>
          <button type="submit" className="home-btn home-btn-primary" disabled={saveState === "saving"}>
            <Save className="h-4 w-4" />
            <span>{saveState === "saving" ? t("revamp.step.common.saving") : t("revamp.step.common.saveSection")}</span>
          </button>
          <Link className="home-btn home-btn-secondary" to="/supplier">
            <Building2 className="h-4 w-4" />
            <span>{t("revamp.step.common.supplierArea")}</span>
          </Link>
        </div>
      </form>
    </section>
  );
}
