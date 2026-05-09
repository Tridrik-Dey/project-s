import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Building2, ImagePlus, Save, Trash2, UserRound } from "lucide-react";
import { Link, Navigate, useParams } from "react-router-dom";
import {
  checkRevampIdentityAvailability,
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
import { useFcrEditMode } from "../../hooks/useFcrEditMode";
import { FcrSubmitBar } from "../../components/supplier/FcrSubmitBar";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

type AlboASection1 = {
  firstName: string;
  lastName: string;
  birthDate: string;
  birthPlace: string;
  taxCode: string;
  vatNumber: string;
  taxRegime: string;
  addressLine: string;
  phone: string;
  secondaryPhone: string;
  email: string;
  secondaryEmail: string;
  pec: string;
  website: string;
  linkedin: string;
  city: string;
  province: string;
  postalCode: string;
  profilePhotoAttachment?: {
    documentType: "OTHER";
    fileName: string;
    mimeType: string;
    sizeBytes: string;
    storageKey: string;
    expiresAt: string;
  };
};

type AlboBSection1 = {
  companyName: string;
  legalForm: string;
  vatNumber: string;
  taxCodeIfDifferent: string;
  reaNumber: string;
  cciaaProvince: string;
  incorporationDate: string;
  legalAddress: {
    street: string;
    city: string;
    cap: string;
    province: string;
  };
  operationalHeadquarter: {
    street: string;
    city: string;
    cap: string;
    province: string;
  };
  institutionalEmail: string;
  pec: string;
  phone: string;
  website: string;
  legalRepresentative: {
    name: string;
    taxCode: string;
    role: string;
  };
  operationalContact: {
    name: string;
    role: string;
    email: string;
    phone: string;
  };
};

type FieldErrors = Record<string, string>;

const emptyA: AlboASection1 = {
  firstName: "",
  lastName: "",
  birthDate: "",
  birthPlace: "",
  taxCode: "",
  vatNumber: "",
  taxRegime: "",
  addressLine: "",
  phone: "",
  secondaryPhone: "",
  email: "",
  secondaryEmail: "",
  pec: "",
  website: "",
  linkedin: "",
  city: "",
  province: "",
  postalCode: "",
  profilePhotoAttachment: undefined
};

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const PHOTO_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const emptyB: AlboBSection1 = {
  companyName: "",
  legalForm: "",
  vatNumber: "",
  taxCodeIfDifferent: "",
  reaNumber: "",
  cciaaProvince: "",
  incorporationDate: "",
  legalAddress: {
    street: "",
    city: "",
    cap: "",
    province: ""
  },
  operationalHeadquarter: {
    street: "",
    city: "",
    cap: "",
    province: ""
  },
  institutionalEmail: "",
  pec: "",
  phone: "",
  website: "",
  legalRepresentative: {
    name: "",
    taxCode: "",
    role: ""
  },
  operationalContact: {
    name: "",
    role: "",
    email: "",
    phone: ""
  }
};

function parsePayload<T>(payloadJson?: string | null): T | null {
  if (!payloadJson) return null;
  try {
    return JSON.parse(payloadJson) as T;
  } catch {
    return null;
  }
}

export function RevampApplicationStep1Page() {
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const initializedRef = useRef(false);
  const { applicationId } = useParams();
  const { auth } = useAuth();
  const fcr = useFcrEditMode();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [summary, setSummary] = useState<RevampApplicationSummary | null>(null);
  const [alboA, setAlboA] = useState<AlboASection1>(emptyA);
  const [alboB, setAlboB] = useState<AlboBSection1>(emptyB);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [duplicateErrors, setDuplicateErrors] = useState<FieldErrors>({});
  const [profilePhotoPreviewUrl, setProfilePhotoPreviewUrl] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const registryType = summary?.registryType;

  const saveLabel = useMemo(() => {
    if (saveState === "saving") return t("revamp.step.common.saveState.saving");
    if (saveState === "saved") return lastSavedAt ? t("revamp.step.common.saveState.savedAt", { time: lastSavedAt }) : t("revamp.step.common.saveState.saved");
    if (saveState === "error") return t("revamp.step.common.saveState.error");
    if (saveState === "dirty") return t("revamp.step.common.saveState.dirty");
    return t("revamp.step.common.saveState.idle");
  }, [lastSavedAt, saveState, t]);

  const liveDisplayName = registryType === "ALBO_A"
    ? [alboA.firstName, alboA.lastName].map((part) => part.trim()).filter(Boolean).join(" ")
    : registryType === "ALBO_B"
      ? alboB.companyName.trim()
      : "";
  const identityName = liveDisplayName || auth?.email || "Utente";
  const identityInitials = registryType === "ALBO_A"
    ? `${alboA.firstName.trim().charAt(0)}${alboA.lastName.trim().charAt(0)}`.toUpperCase() || identityName.slice(0, 2).toUpperCase()
    : identityName.slice(0, 2).toUpperCase();

  useEffect(() => {
    if (!registryType) return;
    sessionStorage.setItem("supplier_identity_preview", JSON.stringify({
      name: identityName,
      initials: identityInitials
    }));
    window.dispatchEvent(new CustomEvent("supplier:identity-preview", {
      detail: { name: identityName, initials: identityInitials }
    }));
  }, [identityInitials, identityName, registryType]);

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
          resumePath: `/application/${applicationId}/step/1`
        });

        const sections = await getRevampApplicationSections(applicationId, auth.token);
        const step1 = sections.find((section) => section.sectionKey === "S1");

        if (appSummary.registryType === "ALBO_A") {
          const parsed = parsePayload<AlboASection1>(step1?.payloadJson);
          if (parsed) {
            setAlboA({
              firstName: parsed.firstName ?? "",
              lastName: parsed.lastName ?? "",
              birthDate: parsed.birthDate ?? "",
              birthPlace: parsed.birthPlace ?? "",
              taxCode: parsed.taxCode ?? "",
              vatNumber: parsed.vatNumber ?? "",
              taxRegime: parsed.taxRegime ?? "",
              addressLine: parsed.addressLine ?? "",
              phone: parsed.phone ?? "",
              secondaryPhone: parsed.secondaryPhone ?? "",
              email: parsed.email || auth?.email || "",
              secondaryEmail: parsed.secondaryEmail ?? "",
              pec: parsed.pec ?? "",
              website: parsed.website ?? "",
              linkedin: parsed.linkedin ?? "",
              city: parsed.city ?? "",
              province: parsed.province ?? "",
              postalCode: parsed.postalCode ?? "",
              profilePhotoAttachment: parsed.profilePhotoAttachment && parsed.profilePhotoAttachment.fileName && parsed.profilePhotoAttachment.storageKey
                ? {
                    documentType: "OTHER",
                    fileName: parsed.profilePhotoAttachment.fileName,
                    mimeType: parsed.profilePhotoAttachment.mimeType ?? "",
                    sizeBytes: parsed.profilePhotoAttachment.sizeBytes ?? "",
                    storageKey: parsed.profilePhotoAttachment.storageKey,
                    expiresAt: parsed.profilePhotoAttachment.expiresAt ?? ""
                  }
                : undefined
            });
          } else {
            setAlboA((prev) => ({ ...prev, email: auth?.email ?? "" }));
          }
        } else if (appSummary.registryType === "ALBO_B") {
          const parsed = parsePayload<AlboBSection1>(step1?.payloadJson);
          if (parsed) {
            setAlboB({
              companyName: parsed.companyName ?? "",
              legalForm: parsed.legalForm ?? "",
              vatNumber: parsed.vatNumber ?? "",
              taxCodeIfDifferent: parsed.taxCodeIfDifferent ?? "",
              reaNumber: parsed.reaNumber ?? "",
              cciaaProvince: parsed.cciaaProvince ?? "",
              incorporationDate: parsed.incorporationDate ?? "",
              legalAddress: {
                street: parsed.legalAddress?.street ?? "",
                city: parsed.legalAddress?.city ?? "",
                cap: parsed.legalAddress?.cap ?? "",
                province: parsed.legalAddress?.province ?? ""
              },
              operationalHeadquarter: {
                street: parsed.operationalHeadquarter?.street ?? "",
                city: parsed.operationalHeadquarter?.city ?? "",
                cap: parsed.operationalHeadquarter?.cap ?? "",
                province: parsed.operationalHeadquarter?.province ?? ""
              },
              institutionalEmail: parsed.institutionalEmail || auth?.email || "",
              pec: parsed.pec ?? "",
              phone: parsed.phone ?? "",
              website: parsed.website ?? "",
              legalRepresentative: {
                name: parsed.legalRepresentative?.name ?? (parsed as unknown as { legalRepresentativeName?: string }).legalRepresentativeName ?? "",
                taxCode: parsed.legalRepresentative?.taxCode ?? "",
                role: parsed.legalRepresentative?.role ?? ""
              },
              operationalContact: {
                name: parsed.operationalContact?.name ?? "",
                role: parsed.operationalContact?.role ?? "",
                email: parsed.operationalContact?.email ?? (parsed as unknown as { operationalContactEmail?: string }).operationalContactEmail ?? "",
                phone: parsed.operationalContact?.phone ?? ""
              }
            });
          } else {
            setAlboB((prev) => ({ ...prev, institutionalEmail: auth?.email ?? "" }));
          }
        }

        if (step1?.updatedAt) {
          setLastSavedAt(new Date(step1.updatedAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }));
          setSaveState("saved");
        } else {
          setSaveState("idle");
        }
      } catch (error) {
        const message = error instanceof HttpError ? error.message : t("revamp.step.common.loadErrorFallback");
        setLoadError(message);
      } finally {
        setLoading(false);
        initializedRef.current = true;
      }
    }

    void bootstrap();
  }, [applicationId, auth?.token, t]);

  useEffect(() => {
    if (saveState !== "dirty" || !initializedRef.current) return;
    if (!applicationId || !auth?.token || !registryType) return;

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(() => {
      void persistSection("auto");
    }, 1200);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [saveState, alboA, alboB, applicationId, auth?.token, registryType]);

  useEffect(() => {
    if (!applicationId || !auth?.token || !registryType || loading) return;

    const field = registryType === "ALBO_A" ? "taxCode" : "vatNumber";
    const value = registryType === "ALBO_A" ? alboA.taxCode : alboB.vatNumber;
    const trimmed = value.trim();
    if (!trimmed) {
      setDuplicateErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      checkRevampIdentityAvailability(applicationId, field, trimmed, auth.token)
        .then((result) => {
          if (cancelled) return;
          setDuplicateErrors((prev) => {
            const next = { ...prev };
            if (!result.available && result.messageKey) {
              next[field] = t(result.messageKey);
            } else {
              delete next[field];
            }
            return next;
          });
          setErrors((prev) => {
            const next = { ...prev };
            if (!result.available && result.messageKey) {
              next[field] = t(result.messageKey);
            } else if (next[field] === t("validation.duplicate.taxId") || next[field] === t("validation.duplicate.vatNumber")) {
              delete next[field];
            }
            return next;
          });
        })
        .catch(() => {
          if (cancelled) return;
          setDuplicateErrors((prev) => {
            const next = { ...prev };
            delete next[field];
            return next;
          });
        });
    }, 450);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [alboA.taxCode, alboB.vatNumber, applicationId, auth?.token, loading, registryType, t]);

  useEffect(() => {
    if (!auth?.email || !registryType || loading) return;
    if (registryType === "ALBO_A" && !alboA.email) {
      setAlboA((prev) => ({ ...prev, email: auth.email }));
    }
    if (registryType === "ALBO_B" && !alboB.institutionalEmail) {
      setAlboB((prev) => ({ ...prev, institutionalEmail: auth.email }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.email, registryType, loading]);

  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (saveState !== "dirty" && saveState !== "saving") return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [saveState]);

  function markDirty() {
    setSaveState((prev) => (prev === "saving" ? prev : "dirty"));
  }

  async function onProfilePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!PHOTO_MIME_TYPES.has(file.type)) {
      setErrors((prev) => ({ ...prev, profilePhoto: "Formato non supportato. Usa JPG, PNG o WEBP." }));
      return;
    }

    if (file.size > MAX_PHOTO_BYTES) {
      setErrors((prev) => ({ ...prev, profilePhoto: "Dimensione massima 2MB." }));
      return;
    }

    setProfilePhotoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });

    setAlboA((prev) => ({
      ...prev,
      profilePhotoAttachment: {
        documentType: "OTHER",
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: String(file.size),
        storageKey: `upload://profile-photo/${Date.now()}-${file.name.replace(/\s+/g, "_")}`,
        expiresAt: ""
      }
    }));
    setErrors((prev) => ({ ...prev, profilePhoto: "" }));
    markDirty();
  }

  function onRemoveProfilePhoto() {
    setProfilePhotoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setAlboA((prev) => ({
      ...prev,
      profilePhotoAttachment: undefined
    }));
    if (photoInputRef.current) {
      photoInputRef.current.value = "";
    }
    markDirty();
  }

  useEffect(() => {
    return () => {
      if (profilePhotoPreviewUrl) {
        URL.revokeObjectURL(profilePhotoPreviewUrl);
      }
    };
  }, [profilePhotoPreviewUrl]);

  function validateForm(type: RevampRegistryType): FieldErrors {
    if (type === "ALBO_A") {
      const next: FieldErrors = {};
      if (!alboA.firstName.trim()) next.firstName = t("revamp.step1.error.firstNameRequired");
      if (!alboA.lastName.trim()) next.lastName = t("revamp.step1.error.lastNameRequired");
      if (!alboA.birthDate.trim()) next.birthDate = t("revamp.step1.error.birthDateRequired");
      if (!alboA.birthPlace.trim()) next.birthPlace = t("revamp.step1.error.birthPlaceRequired");
      if (!alboA.taxCode.trim()) next.taxCode = t("revamp.step1.error.taxCodeRequired");
      if (!alboA.addressLine.trim()) next.addressLine = t("revamp.step1.error.addressLineRequired");
      if (!alboA.phone.trim()) next.phone = t("revamp.step1.error.phoneRequired");
      if (!alboA.email.trim()) next.email = t("revamp.step1.error.emailRequired");
      if (!alboA.city.trim()) next.city = t("revamp.step1.error.cityRequired");
      if (!alboA.province.trim()) next.province = t("revamp.step1.error.provinceRequired");
      if (!alboA.postalCode.trim()) next.postalCode = t("revamp.step1.error.postalCodeRequired");
      return next;
    }

    const next: FieldErrors = {};
    if (!alboB.companyName.trim()) next.companyName = t("revamp.step1.error.companyNameRequired");
    if (!alboB.legalForm.trim()) next.legalForm = "Forma giuridica obbligatoria.";
    if (!alboB.vatNumber.trim()) next.vatNumber = t("revamp.step1.error.vatRequired");
    if (!alboB.reaNumber.trim()) next.reaNumber = t("revamp.step1.error.reaRequired");
    if (!alboB.cciaaProvince.trim()) next.cciaaProvince = t("revamp.step1.error.cciaaRequired");
    if (!alboB.incorporationDate.trim()) next.incorporationDate = t("revamp.step1.error.incorporationDateRequired");
    if (!alboB.legalAddress.street.trim()) next.legalAddressStreet = "Indirizzo sede legale obbligatorio.";
    if (!alboB.legalAddress.city.trim()) next.legalAddressCity = "Citta sede legale obbligatoria.";
    if (!alboB.legalAddress.cap.trim()) next.legalAddressCap = "CAP sede legale obbligatorio.";
    if (!alboB.legalAddress.province.trim()) next.legalAddressProvince = "Provincia sede legale obbligatoria.";
    if (!alboB.institutionalEmail.trim()) next.institutionalEmail = "Email istituzionale obbligatoria.";
    if (!alboB.phone.trim()) next.phone = "Telefono obbligatorio.";
    if (!alboB.legalRepresentative.name.trim()) next.legalRepresentativeName = t("revamp.step1.error.legalRepRequired");
    if (!alboB.legalRepresentative.taxCode.trim()) next.legalRepresentativeTaxCode = "Codice fiscale legale rappresentante obbligatorio.";
    if (!alboB.legalRepresentative.role.trim()) next.legalRepresentativeRole = "Ruolo legale rappresentante obbligatorio.";
    if (!alboB.operationalContact.name.trim()) next.operationalContactName = "Referente operativo obbligatorio.";
    if (!alboB.operationalContact.email.trim()) next.operationalContactEmail = t("revamp.step1.error.operationalEmailRequired");
    if (!alboB.operationalContact.phone.trim()) next.operationalContactPhone = "Telefono referente operativo obbligatorio.";
    return next;
  }

  async function persistSection(source: "manual" | "auto") {
    if (!applicationId || !auth?.token || !registryType) return;

    const validationErrors = validateForm(registryType);
    const fieldErrors = { ...validationErrors, ...duplicateErrors };
    if (source === "manual") {
      setErrors(fieldErrors);
    }
    if (Object.keys(duplicateErrors).length > 0) {
      setSaveState("error");
      return;
    }
    const completed = Object.keys(fieldErrors).length === 0;

    setSaveState("saving");
    try {
      const payload = registryType === "ALBO_A" ? alboA : alboB;
      const saved = await saveRevampApplicationSection(
        applicationId,
        "S1",
        JSON.stringify(payload),
        completed,
        auth.token
      );
      setLastSavedAt(new Date(saved.updatedAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }));
      setSaveState("saved");
    } catch (error) {
      if (error instanceof HttpError && error.message.startsWith("validation.duplicate.")) {
        const field = registryType === "ALBO_A" ? "taxCode" : "vatNumber";
        const message = t(error.message);
        setDuplicateErrors((prev) => ({ ...prev, [field]: message }));
        setErrors((prev) => ({ ...prev, [field]: message }));
      }
      setSaveState("error");
    }
  }

  async function saveSection(event: FormEvent) {
    event.preventDefault();
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    await persistSection("manual");
  }

  async function saveSectionProgrammatic() {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    await persistSection("manual");
  }

  if (!applicationId) {
    return <Navigate to="/apply" replace />;
  }

  if (!auth?.token) {
    return <Navigate to="/login" replace />;
  }

  if (loading) {
    return (
      <section className="stack">
        <div className="panel">
          <h2>{t("revamp.step1.loading")}</h2>
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

  return (
    <section className="stack">
      <div className="panel revamp-step-header">
        <h2>{registryType === "ALBO_A" ? t("revamp.step1.title.alboA") : t("revamp.step1.title.alboB")}</h2>
        <p className="subtle">
          {fcr.active
            ? `Candidatura ${applicationId} - Richiesta di modifica: ${saveLabel}`
            : t("revamp.step.common.subtitle", { id: applicationId, state: saveLabel })}
        </p>
      </div>

      <form className="panel stack" onSubmit={saveSection}>
        {registryType === "ALBO_A" ? (
          <>
            <h3 className="revamp-step-subtitle"><UserRound className="h-4 w-4" /> {t("revamp.step1.alboA.sectionTitle")}</h3>

            {/* ── foto_profilo ── */}
            <fieldset
              className={`fcr-group${fcr.active ? (fcr.isLocked("foto_profilo") ? " fcr-locked" : " fcr-active-group") : ""}`}
              disabled={fcr.active && fcr.isLocked("foto_profilo")}
            >
              <legend className="fcr-group-legend">Foto profilo</legend>
              <div className="home-step-card">
                <div className="home-step-head">
                  <span className="home-step-index">P</span>
                  <h4>Foto profilo (opzionale)</h4>
                </div>
                <p className="subtle">Formati supportati: JPG, PNG, WEBP. Dimensione massima: 2MB.</p>
                <div className="revamp-step-actions">
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => void onProfilePhotoChange(e)}
                  />
                  {alboA.profilePhotoAttachment ? (
                    <button type="button" className="home-btn home-btn-secondary" onClick={onRemoveProfilePhoto}>
                      <Trash2 className="h-4 w-4" />
                      Rimuovi foto
                    </button>
                  ) : null}
                </div>
                {alboA.profilePhotoAttachment ? (
                  <div className="home-step-card" style={{ marginTop: "0.6rem" }}>
                    {profilePhotoPreviewUrl ? (
                      <img
                        src={profilePhotoPreviewUrl}
                        alt="Anteprima foto profilo"
                        style={{ width: "120px", height: "120px", objectFit: "cover", borderRadius: "10px", border: "1px solid #c8d8e7" }}
                      />
                    ) : (
                      <div style={{ width: "120px", height: "120px", borderRadius: "10px", border: "1px solid #c8d8e7", display: "grid", placeItems: "center", color: "#537092" }}>
                        Foto caricata
                      </div>
                    )}
                    <p className="subtle" style={{ marginTop: "0.4rem" }}>
                      <ImagePlus className="h-4 w-4" /> {alboA.profilePhotoAttachment.fileName || "Immagine caricata"}
                    </p>
                  </div>
                ) : null}
                {errors.profilePhoto ? <p className="error">{errors.profilePhoto}</p> : null}
              </div>
            </fieldset>

            {/* ── dati_personali ── */}
            <fieldset
              className={`fcr-group${fcr.active ? (fcr.isLocked("dati_personali") ? " fcr-locked" : " fcr-active-group") : ""}`}
              disabled={fcr.active && fcr.isLocked("dati_personali")}
            >
              <legend className="fcr-group-legend">Dati anagrafici</legend>
              <div className="grid-form">
              <label className={`floating-field ${alboA.firstName ? "has-value" : ""}`}>
                <input
                  className="floating-input auth-input"
                  value={alboA.firstName}
                  onChange={(e) => {
                    setAlboA((prev) => ({ ...prev, firstName: e.target.value }));
                    markDirty();
                  }}
                  placeholder=" "
                />
                <span className="floating-field-label">{t("revamp.step1.field.firstName")}</span>
              </label>
              <label className={`floating-field ${alboA.lastName ? "has-value" : ""}`}>
                <input
                  className="floating-input auth-input"
                  value={alboA.lastName}
                  onChange={(e) => {
                    setAlboA((prev) => ({ ...prev, lastName: e.target.value }));
                    markDirty();
                  }}
                  placeholder=" "
                />
                <span className="floating-field-label">{t("revamp.step1.field.lastName")}</span>
              </label>
              <label className={`floating-field ${alboA.birthDate ? "has-value" : ""}`}>
                <input
                  className="floating-input auth-input"
                  type="date"
                  value={alboA.birthDate}
                  onChange={(e) => {
                    setAlboA((prev) => ({ ...prev, birthDate: e.target.value }));
                    markDirty();
                  }}
                  placeholder=" "
                />
                <span className="floating-field-label">{t("revamp.step1.field.birthDate")}</span>
              </label>
              <label className={`floating-field ${alboA.birthPlace ? "has-value" : ""}`}>
                <input
                  className="floating-input auth-input"
                  value={alboA.birthPlace}
                  onChange={(e) => {
                    setAlboA((prev) => ({ ...prev, birthPlace: e.target.value }));
                    markDirty();
                  }}
                  placeholder=" "
                />
                <span className="floating-field-label">{t("revamp.step1.field.birthPlace")}</span>
              </label>
            </div>
            </fieldset>

            {/* ── dati_fiscali ── */}
            <fieldset
              className={`fcr-group${fcr.active ? (fcr.isLocked("dati_fiscali") ? " fcr-locked" : " fcr-active-group") : ""}`}
              disabled={fcr.active && fcr.isLocked("dati_fiscali")}
            >
              <legend className="fcr-group-legend">Dati fiscali</legend>
              <div className="grid-form">
                <label className={`floating-field ${alboA.taxCode ? "has-value" : ""}`}>
                  <input className="floating-input auth-input" value={alboA.taxCode} onChange={(e) => { setAlboA((prev) => ({ ...prev, taxCode: e.target.value })); markDirty(); }} placeholder=" " />
                  <span className="floating-field-label">{t("revamp.step1.field.taxCode")}</span>
                </label>
                <label className={`floating-field ${alboA.vatNumber ? "has-value" : ""}`}>
                  <input className="floating-input auth-input" value={alboA.vatNumber} onChange={(e) => { setAlboA((prev) => ({ ...prev, vatNumber: e.target.value })); markDirty(); }} placeholder=" " />
                  <span className="floating-field-label">{t("revamp.step1.field.vatNumberOptional")}</span>
                </label>
                <label className={`floating-field ${alboA.taxRegime ? "has-value" : ""}`}>
                  <input className="floating-input auth-input" value={alboA.taxRegime} onChange={(e) => { setAlboA((prev) => ({ ...prev, taxRegime: e.target.value })); markDirty(); }} placeholder=" " />
                  <span className="floating-field-label">{t("revamp.step1.field.taxRegimeOptional")}</span>
                </label>
              </div>
              {errors.taxCode ? <p className="error">{errors.taxCode}</p> : null}
            </fieldset>

            {/* ── indirizzo ── */}
            <fieldset
              className={`fcr-group${fcr.active ? (fcr.isLocked("indirizzo") ? " fcr-locked" : " fcr-active-group") : ""}`}
              disabled={fcr.active && fcr.isLocked("indirizzo")}
            >
              <legend className="fcr-group-legend">Indirizzo professionale</legend>
              <div className="grid-form">
                <label className={`floating-field ${alboA.addressLine ? "has-value" : ""}`}>
                  <input className="floating-input auth-input" value={alboA.addressLine} onChange={(e) => { setAlboA((prev) => ({ ...prev, addressLine: e.target.value })); markDirty(); }} placeholder=" " />
                  <span className="floating-field-label">{t("revamp.step1.field.addressLine")}</span>
                </label>
                <label className={`floating-field ${alboA.city ? "has-value" : ""}`}>
                  <input className="floating-input auth-input" value={alboA.city} onChange={(e) => { setAlboA((prev) => ({ ...prev, city: e.target.value })); markDirty(); }} placeholder=" " />
                  <span className="floating-field-label">{t("revamp.step1.field.city")}</span>
                </label>
                <label className={`floating-field ${alboA.province ? "has-value" : ""}`}>
                  <input className="floating-input auth-input" value={alboA.province} onChange={(e) => { setAlboA((prev) => ({ ...prev, province: e.target.value })); markDirty(); }} placeholder=" " />
                  <span className="floating-field-label">{t("revamp.step1.field.province")}</span>
                </label>
                <label className={`floating-field ${alboA.postalCode ? "has-value" : ""}`}>
                  <input className="floating-input auth-input" value={alboA.postalCode} onChange={(e) => { setAlboA((prev) => ({ ...prev, postalCode: e.target.value })); markDirty(); }} placeholder=" " />
                  <span className="floating-field-label">{t("revamp.step1.field.postalCode")}</span>
                </label>
              </div>
              {errors.addressLine ? <p className="error">{errors.addressLine}</p> : null}
              {errors.city ? <p className="error">{errors.city}</p> : null}
              {errors.province ? <p className="error">{errors.province}</p> : null}
              {errors.postalCode ? <p className="error">{errors.postalCode}</p> : null}
            </fieldset>

            {/* ── contatti ── */}
            <fieldset
              className={`fcr-group${fcr.active ? (fcr.isLocked("contatti") ? " fcr-locked" : " fcr-active-group") : ""}`}
              disabled={fcr.active && fcr.isLocked("contatti")}
            >
              <legend className="fcr-group-legend">Contatti</legend>
              <div className="grid-form">
                <label className={`floating-field ${alboA.phone ? "has-value" : ""}`}>
                  <input className="floating-input auth-input" value={alboA.phone} onChange={(e) => { setAlboA((prev) => ({ ...prev, phone: e.target.value })); markDirty(); }} placeholder=" " />
                  <span className="floating-field-label">{t("revamp.step1.field.phone")}</span>
                </label>
                <label className={`floating-field ${alboA.secondaryPhone ? "has-value" : ""}`}>
                  <input className="floating-input auth-input" value={alboA.secondaryPhone} onChange={(e) => { setAlboA((prev) => ({ ...prev, secondaryPhone: e.target.value })); markDirty(); }} placeholder=" " />
                  <span className="floating-field-label">{t("revamp.step1.field.secondaryPhoneOptional")}</span>
                </label>
                <label className="floating-field has-value">
                  <input className="floating-input auth-input input-field-locked" type="email" value={alboA.email} disabled placeholder=" " onChange={() => undefined} />
                  <span className="floating-field-label">{t("revamp.step1.field.email")}</span>
                </label>
                <label className={`floating-field ${alboA.secondaryEmail ? "has-value" : ""}`}>
                  <input className="floating-input auth-input" type="email" value={alboA.secondaryEmail} onChange={(e) => { setAlboA((prev) => ({ ...prev, secondaryEmail: e.target.value })); markDirty(); }} placeholder=" " />
                  <span className="floating-field-label">{t("revamp.step1.field.secondaryEmailOptional")}</span>
                </label>
                <label className={`floating-field ${alboA.pec ? "has-value" : ""}`}>
                  <input className="floating-input auth-input" type="email" value={alboA.pec} onChange={(e) => { setAlboA((prev) => ({ ...prev, pec: e.target.value })); markDirty(); }} placeholder=" " />
                  <span className="floating-field-label">{t("revamp.step1.field.pecOptional")}</span>
                </label>
                <label className={`floating-field ${alboA.website ? "has-value" : ""}`}>
                  <input className="floating-input auth-input" value={alboA.website} onChange={(e) => { setAlboA((prev) => ({ ...prev, website: e.target.value })); markDirty(); }} placeholder=" " />
                  <span className="floating-field-label">{t("revamp.step1.field.websiteOptional")}</span>
                </label>
                <label className={`floating-field ${alboA.linkedin ? "has-value" : ""}`}>
                  <input className="floating-input auth-input" value={alboA.linkedin} onChange={(e) => { setAlboA((prev) => ({ ...prev, linkedin: e.target.value })); markDirty(); }} placeholder=" " />
                  <span className="floating-field-label">{t("revamp.step1.field.linkedinOptional")}</span>
                </label>
              </div>
              {errors.phone ? <p className="error">{errors.phone}</p> : null}
              {errors.email ? <p className="error">{errors.email}</p> : null}
            </fieldset>

            {errors.firstName ? <p className="error">{errors.firstName}</p> : null}
            {errors.lastName ? <p className="error">{errors.lastName}</p> : null}
            {errors.birthDate ? <p className="error">{errors.birthDate}</p> : null}
            {errors.birthPlace ? <p className="error">{errors.birthPlace}</p> : null}
          </>
        ) : (
          <>
            <h3 className="revamp-step-subtitle"><Building2 className="h-4 w-4" /> {t("revamp.step1.alboB.sectionTitle")}</h3>

            {/* ── dati_aziendali ── */}
            <fieldset className={`fcr-group${fcr.active ? (fcr.isLocked("dati_aziendali") ? " fcr-locked" : " fcr-active-group") : ""}`} disabled={fcr.active && fcr.isLocked("dati_aziendali")}>
              <legend className="fcr-group-legend">Dati aziendali</legend>
              <div className="grid-form">
              <label className={`floating-field ${alboB.companyName ? "has-value" : ""}`}>
                <input
                  className="floating-input auth-input"
                  value={alboB.companyName}
                  onChange={(e) => {
                    setAlboB((prev) => ({ ...prev, companyName: e.target.value }));
                    markDirty();
                  }}
                  placeholder=" "
                />
                <span className="floating-field-label">{t("revamp.step1.field.companyName")}</span>
              </label>
              <label className={`floating-field ${alboB.legalForm ? "has-value" : ""}`}>
                <select
                  className="floating-input auth-input"
                  value={alboB.legalForm}
                  onChange={(e) => {
                    setAlboB((prev) => ({ ...prev, legalForm: e.target.value }));
                    markDirty();
                  }}
                >
                  <option value="">Forma giuridica</option>
                  <option value="SRL">SRL</option>
                  <option value="SPA">SPA</option>
                  <option value="SNC">SNC</option>
                  <option value="SAS">SAS</option>
                  <option value="COOPERATIVA">Cooperativa</option>
                  <option value="ASSOCIAZIONE">Associazione</option>
                  <option value="FONDAZIONE">Fondazione</option>
                  <option value="ETS">ETS</option>
                  <option value="ALTRO">Altro</option>
                </select>
                <span className="floating-field-label">Forma giuridica *</span>
              </label>
            </div>
            {errors.companyName ? <p className="error">{errors.companyName}</p> : null}
            {errors.legalForm ? <p className="error">{errors.legalForm}</p> : null}
            </fieldset>

            {/* ── identificativi ── */}
            <fieldset className={`fcr-group${fcr.active ? (fcr.isLocked("identificativi") ? " fcr-locked" : " fcr-active-group") : ""}`} disabled={fcr.active && fcr.isLocked("identificativi")}>
              <legend className="fcr-group-legend">Identificativi fiscali</legend>
              <div className="grid-form">
                <label className={`floating-field ${alboB.vatNumber ? "has-value" : ""}`}>
                  <input className="floating-input auth-input" value={alboB.vatNumber} onChange={(e) => { setAlboB((prev) => ({ ...prev, vatNumber: e.target.value })); markDirty(); }} placeholder=" " />
                  <span className="floating-field-label">{t("revamp.step1.field.vatNumber")}</span>
                </label>
                <label className={`floating-field ${alboB.taxCodeIfDifferent ? "has-value" : ""}`}>
                  <input className="floating-input auth-input" value={alboB.taxCodeIfDifferent} onChange={(e) => { setAlboB((prev) => ({ ...prev, taxCodeIfDifferent: e.target.value })); markDirty(); }} placeholder=" " />
                  <span className="floating-field-label">Codice fiscale (se diverso)</span>
                </label>
                <label className={`floating-field ${alboB.reaNumber ? "has-value" : ""}`}>
                  <input className="floating-input auth-input" value={alboB.reaNumber} onChange={(e) => { setAlboB((prev) => ({ ...prev, reaNumber: e.target.value })); markDirty(); }} placeholder=" " />
                  <span className="floating-field-label">{t("revamp.step1.field.reaNumber")}</span>
                </label>
                <label className={`floating-field ${alboB.cciaaProvince ? "has-value" : ""}`}>
                  <input className="floating-input auth-input" value={alboB.cciaaProvince} onChange={(e) => { setAlboB((prev) => ({ ...prev, cciaaProvince: e.target.value })); markDirty(); }} placeholder=" " />
                  <span className="floating-field-label">{t("revamp.step1.field.cciaaProvince")}</span>
                </label>
                <label className={`floating-field ${alboB.incorporationDate ? "has-value" : ""}`}>
                  <input className="floating-input auth-input" type="month" value={alboB.incorporationDate} onChange={(e) => { setAlboB((prev) => ({ ...prev, incorporationDate: e.target.value })); markDirty(); }} placeholder=" " />
                  <span className="floating-field-label">{t("revamp.step1.field.incorporationDate")}</span>
                </label>
              </div>
              {errors.vatNumber ? <p className="error">{errors.vatNumber}</p> : null}
              {errors.reaNumber ? <p className="error">{errors.reaNumber}</p> : null}
              {errors.cciaaProvince ? <p className="error">{errors.cciaaProvince}</p> : null}
              {errors.incorporationDate ? <p className="error">{errors.incorporationDate}</p> : null}
            </fieldset>

            {/* ── sede_legale ── */}
            <fieldset className={`fcr-group${fcr.active ? (fcr.isLocked("sede_legale") ? " fcr-locked" : " fcr-active-group") : ""}`} disabled={fcr.active && fcr.isLocked("sede_legale")}>
              <legend className="fcr-group-legend">Sede legale</legend>
              <div className="grid-form">
                <label className={`floating-field ${alboB.legalAddress.street ? "has-value" : ""}`}>
                  <input className="floating-input auth-input" value={alboB.legalAddress.street} onChange={(e) => { const v = e.target.value; setAlboB((prev) => ({ ...prev, legalAddress: { ...prev.legalAddress, street: v } })); markDirty(); }} placeholder=" " />
                  <span className="floating-field-label">Sede legale - indirizzo *</span>
                </label>
                <label className={`floating-field ${alboB.legalAddress.city ? "has-value" : ""}`}>
                  <input className="floating-input auth-input" value={alboB.legalAddress.city} onChange={(e) => { const v = e.target.value; setAlboB((prev) => ({ ...prev, legalAddress: { ...prev.legalAddress, city: v } })); markDirty(); }} placeholder=" " />
                  <span className="floating-field-label">Sede legale - città *</span>
                </label>
                <label className={`floating-field ${alboB.legalAddress.cap ? "has-value" : ""}`}>
                  <input className="floating-input auth-input" value={alboB.legalAddress.cap} onChange={(e) => { const v = e.target.value; setAlboB((prev) => ({ ...prev, legalAddress: { ...prev.legalAddress, cap: v } })); markDirty(); }} placeholder=" " />
                  <span className="floating-field-label">Sede legale - CAP *</span>
                </label>
                <label className={`floating-field ${alboB.legalAddress.province ? "has-value" : ""}`}>
                  <input className="floating-input auth-input" value={alboB.legalAddress.province} onChange={(e) => { const v = e.target.value; setAlboB((prev) => ({ ...prev, legalAddress: { ...prev.legalAddress, province: v } })); markDirty(); }} placeholder=" " />
                  <span className="floating-field-label">Sede legale - provincia *</span>
                </label>
              </div>
              {errors.legalAddressStreet ? <p className="error">{errors.legalAddressStreet}</p> : null}
              {errors.legalAddressCity ? <p className="error">{errors.legalAddressCity}</p> : null}
              {errors.legalAddressCap ? <p className="error">{errors.legalAddressCap}</p> : null}
              {errors.legalAddressProvince ? <p className="error">{errors.legalAddressProvince}</p> : null}
            </fieldset>

            {/* ── sede_operativa ── */}
            <fieldset className={`fcr-group${fcr.active ? (fcr.isLocked("sede_operativa") ? " fcr-locked" : " fcr-active-group") : ""}`} disabled={fcr.active && fcr.isLocked("sede_operativa")}>
              <legend className="fcr-group-legend">Sede operativa</legend>
              <div className="grid-form">
                <label className={`floating-field ${alboB.operationalHeadquarter.street ? "has-value" : ""}`}>
                  <input className="floating-input auth-input" value={alboB.operationalHeadquarter.street} onChange={(e) => { const v = e.target.value; setAlboB((prev) => ({ ...prev, operationalHeadquarter: { ...prev.operationalHeadquarter, street: v } })); markDirty(); }} placeholder=" " />
                  <span className="floating-field-label">Sede operativa - indirizzo</span>
                </label>
                <label className={`floating-field ${alboB.operationalHeadquarter.city ? "has-value" : ""}`}>
                  <input className="floating-input auth-input" value={alboB.operationalHeadquarter.city} onChange={(e) => { const v = e.target.value; setAlboB((prev) => ({ ...prev, operationalHeadquarter: { ...prev.operationalHeadquarter, city: v } })); markDirty(); }} placeholder=" " />
                  <span className="floating-field-label">Sede operativa - città</span>
                </label>
                <label className={`floating-field ${alboB.operationalHeadquarter.cap ? "has-value" : ""}`}>
                  <input className="floating-input auth-input" value={alboB.operationalHeadquarter.cap} onChange={(e) => { const v = e.target.value; setAlboB((prev) => ({ ...prev, operationalHeadquarter: { ...prev.operationalHeadquarter, cap: v } })); markDirty(); }} placeholder=" " />
                  <span className="floating-field-label">Sede operativa - CAP</span>
                </label>
                <label className={`floating-field ${alboB.operationalHeadquarter.province ? "has-value" : ""}`}>
                  <input className="floating-input auth-input" value={alboB.operationalHeadquarter.province} onChange={(e) => { const v = e.target.value; setAlboB((prev) => ({ ...prev, operationalHeadquarter: { ...prev.operationalHeadquarter, province: v } })); markDirty(); }} placeholder=" " />
                  <span className="floating-field-label">Sede operativa - provincia</span>
                </label>
              </div>
            </fieldset>

            {/* ── contatti_inst ── */}
            <fieldset className={`fcr-group${fcr.active ? (fcr.isLocked("contatti_inst") ? " fcr-locked" : " fcr-active-group") : ""}`} disabled={fcr.active && fcr.isLocked("contatti_inst")}>
              <legend className="fcr-group-legend">Contatti istituzionali</legend>
              <div className="grid-form">
                <label className="floating-field has-value">
                  <input className="floating-input auth-input input-field-locked" type="email" value={alboB.institutionalEmail} disabled placeholder=" " onChange={() => undefined} />
                  <span className="floating-field-label">Email istituzionale *</span>
                </label>
                <label className={`floating-field ${alboB.pec ? "has-value" : ""}`}>
                  <input className="floating-input auth-input" type="email" value={alboB.pec} onChange={(e) => { setAlboB((prev) => ({ ...prev, pec: e.target.value })); markDirty(); }} placeholder=" " />
                  <span className="floating-field-label">PEC</span>
                </label>
                <label className={`floating-field ${alboB.phone ? "has-value" : ""}`}>
                  <input className="floating-input auth-input" value={alboB.phone} onChange={(e) => { setAlboB((prev) => ({ ...prev, phone: e.target.value })); markDirty(); }} placeholder=" " />
                  <span className="floating-field-label">Telefono *</span>
                </label>
                <label className={`floating-field ${alboB.website ? "has-value" : ""}`}>
                  <input className="floating-input auth-input" value={alboB.website} onChange={(e) => { setAlboB((prev) => ({ ...prev, website: e.target.value })); markDirty(); }} placeholder=" " />
                  <span className="floating-field-label">Sito web</span>
                </label>
              </div>
              {errors.institutionalEmail ? <p className="error">{errors.institutionalEmail}</p> : null}
              {errors.phone ? <p className="error">{errors.phone}</p> : null}
            </fieldset>

            {/* ── leg_rappr ── */}
            <fieldset className={`fcr-group${fcr.active ? (fcr.isLocked("leg_rappr") ? " fcr-locked" : " fcr-active-group") : ""}`} disabled={fcr.active && fcr.isLocked("leg_rappr")}>
              <legend className="fcr-group-legend">Legale rappresentante</legend>
              <div className="grid-form">
                <label className={`floating-field ${alboB.legalRepresentative.name ? "has-value" : ""}`}>
                  <input className="floating-input auth-input" value={alboB.legalRepresentative.name} onChange={(e) => { const v = e.target.value; setAlboB((prev) => ({ ...prev, legalRepresentative: { ...prev.legalRepresentative, name: v } })); markDirty(); }} placeholder=" " />
                  <span className="floating-field-label">Legale rappresentante - nome *</span>
                </label>
                <label className={`floating-field ${alboB.legalRepresentative.taxCode ? "has-value" : ""}`}>
                  <input className="floating-input auth-input" value={alboB.legalRepresentative.taxCode} onChange={(e) => { const v = e.target.value; setAlboB((prev) => ({ ...prev, legalRepresentative: { ...prev.legalRepresentative, taxCode: v } })); markDirty(); }} placeholder=" " />
                  <span className="floating-field-label">Legale rappresentante - codice fiscale *</span>
                </label>
                <label className={`floating-field ${alboB.legalRepresentative.role ? "has-value" : ""}`}>
                  <input className="floating-input auth-input" value={alboB.legalRepresentative.role} onChange={(e) => { const v = e.target.value; setAlboB((prev) => ({ ...prev, legalRepresentative: { ...prev.legalRepresentative, role: v } })); markDirty(); }} placeholder=" " />
                  <span className="floating-field-label">Legale rappresentante - ruolo *</span>
                </label>
              </div>
              {errors.legalRepresentativeName ? <p className="error">{errors.legalRepresentativeName}</p> : null}
              {errors.legalRepresentativeTaxCode ? <p className="error">{errors.legalRepresentativeTaxCode}</p> : null}
              {errors.legalRepresentativeRole ? <p className="error">{errors.legalRepresentativeRole}</p> : null}
            </fieldset>

            {/* ── ref_operativo ── */}
            <fieldset className={`fcr-group${fcr.active ? (fcr.isLocked("ref_operativo") ? " fcr-locked" : " fcr-active-group") : ""}`} disabled={fcr.active && fcr.isLocked("ref_operativo")}>
              <legend className="fcr-group-legend">Referente operativo</legend>
              <div className="grid-form">
                <label className={`floating-field ${alboB.operationalContact.name ? "has-value" : ""}`}>
                  <input className="floating-input auth-input" value={alboB.operationalContact.name} onChange={(e) => { const v = e.target.value; setAlboB((prev) => ({ ...prev, operationalContact: { ...prev.operationalContact, name: v } })); markDirty(); }} placeholder=" " />
                  <span className="floating-field-label">Referente operativo - nome *</span>
                </label>
                <label className={`floating-field ${alboB.operationalContact.role ? "has-value" : ""}`}>
                  <input className="floating-input auth-input" value={alboB.operationalContact.role} onChange={(e) => { const v = e.target.value; setAlboB((prev) => ({ ...prev, operationalContact: { ...prev.operationalContact, role: v } })); markDirty(); }} placeholder=" " />
                  <span className="floating-field-label">Referente operativo - ruolo</span>
                </label>
                <label className={`floating-field ${alboB.operationalContact.email ? "has-value" : ""}`}>
                  <input className="floating-input auth-input" type="email" value={alboB.operationalContact.email} onChange={(e) => { const v = e.target.value; setAlboB((prev) => ({ ...prev, operationalContact: { ...prev.operationalContact, email: v } })); markDirty(); }} placeholder=" " />
                  <span className="floating-field-label">Referente operativo - email *</span>
                </label>
                <label className={`floating-field ${alboB.operationalContact.phone ? "has-value" : ""}`}>
                  <input className="floating-input auth-input" value={alboB.operationalContact.phone} onChange={(e) => { const v = e.target.value; setAlboB((prev) => ({ ...prev, operationalContact: { ...prev.operationalContact, phone: v } })); markDirty(); }} placeholder=" " />
                  <span className="floating-field-label">Referente operativo - telefono *</span>
                </label>
              </div>
              {errors.operationalContactName ? <p className="error">{errors.operationalContactName}</p> : null}
              {errors.operationalContactEmail ? <p className="error">{errors.operationalContactEmail}</p> : null}
              {errors.operationalContactPhone ? <p className="error">{errors.operationalContactPhone}</p> : null}
            </fieldset>
          </>
        )}

        <div className="revamp-step-actions">
          {!fcr.active && (
            <Link className="home-btn home-btn-secondary" to={`/application/${applicationId}/step/2`}>
              {t("revamp.step1.goToStep2")}
            </Link>
          )}
          {!fcr.active && (
            <button
              type="submit"
              className="home-btn home-btn-primary"
              disabled={saveState === "saving"}
            >
              <Save className="h-4 w-4" />
              <span>{saveState === "saving" ? t("revamp.step.common.saving") : t("revamp.step.common.saveSection")}</span>
            </button>
          )}
          {!fcr.active && (
            <Link className="home-btn home-btn-secondary" to="/supplier">
              {t("revamp.step.common.supplierArea")}
            </Link>
          )}
        </div>
      </form>
      {auth && <FcrSubmitBar fcr={fcr} token={auth.token!} onSectionSaved={saveSectionProgrammatic} />}
    </section>
  );
}
