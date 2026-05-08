import { FormEvent, useEffect, useMemo, useState } from "react";
import { Building2, GraduationCap, Save, Wrench } from "lucide-react";
import { Link, Navigate, useParams } from "react-router-dom";
import {
  getRevampApplicationSections,
  getRevampApplicationSummary,
  saveRevampApplicationSection,
  type RevampApplicationSummary,
  type RevampRegistryType,
  type RevampSectionSnapshot
} from "../../api/revampApplicationApi";
import { HttpError } from "../../api/http";
import { useAuth } from "../../auth/AuthContext";
import { useI18n } from "../../i18n/I18nContext";
import { saveRevampApplicationSession } from "../../utils/revampApplicationSession";
import { resolveStepGuardRedirect } from "./revampFlow";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";
type FieldErrors = Record<string, string>;

type Section2AlboA = {
  professionalType?: string;
};

type Section3A = {
  education: {
    highestTitle: string;
    studyArea: string;
    graduationYear: string;
  };
  certifications: Array<{
    name: string;
    issuer: string;
    year: string;
  }>;
  competencies: Array<{
    theme: string;
    details: string;
    yearsBand: string;
  }>;
  paTeachingExperience: boolean;
  consultingAreasCsv: string;
  territoryRegionsCsv: string;
  territoryProvincesCsv: string;
  languages: Array<{
    language: string;
    qcerLevel: string;
  }>;
  teachingLanguagesCsv: string;
  digitalToolsCsv: string;
  professionalNetworksCsv: string;
  availability: {
    travelAvailable: boolean;
    dailyRateRange: string;
    hourlyRateRange: string;
  };
  experiences: Array<{
    clientName: string;
    clientSector: string;
    interventionType: string;
    mainTheme: string;
    periodFrom: string;
    periodTo: string;
    durationHours: string;
    participantsCount: string;
    deliveryMode: string;
    fundedIntervention: boolean;
    fundName: string;
  }>;
};

type Section3B = {
  professionalOrder: string;
  highestTitle: string;
  studyArea: string;
  experienceBand: string;
  services: string[];
  territory: {
    regionsCsv: string;
    provincesCsv: string;
  };
  hourlyRateRange: string;
  specificCertifications: Array<{
    name: string;
    issuer: string;
    year: string;
  }>;
};

type Section3Company = {
  serviceCategoriesCsv: string;
  servicesDescription: string;
  servicesByCategory?: Record<string, string[]>;
  descriptionsByCategory?: Record<string, string>;
};

const empty3A: Section3A = {
  education: {
    highestTitle: "",
    studyArea: "",
    graduationYear: ""
  },
  certifications: [{ name: "", issuer: "", year: "" }],
  competencies: [{ theme: "", details: "", yearsBand: "" }],
  paTeachingExperience: false,
  consultingAreasCsv: "",
  territoryRegionsCsv: "",
  territoryProvincesCsv: "",
  languages: [{ language: "", qcerLevel: "" }],
  teachingLanguagesCsv: "",
  digitalToolsCsv: "",
  professionalNetworksCsv: "",
  availability: {
    travelAvailable: false,
    dailyRateRange: "",
    hourlyRateRange: ""
  },
  experiences: [
    {
      clientName: "",
      clientSector: "",
      interventionType: "",
      mainTheme: "",
      periodFrom: "",
      periodTo: "",
      durationHours: "",
      participantsCount: "",
      deliveryMode: "",
      fundedIntervention: false,
      fundName: ""
    }
  ]
};

const empty3B: Section3B = {
  professionalOrder: "",
  highestTitle: "",
  studyArea: "",
  experienceBand: "",
  services: [],
  territory: {
    regionsCsv: "",
    provincesCsv: ""
  },
  hourlyRateRange: "",
  specificCertifications: [{ name: "", issuer: "", year: "" }]
};

const S3B_SERVICE_OPTIONS = [
  "Audit e due diligence",
  "Consulenza organizzativa",
  "Compliance normativa",
  "Consulenza HR",
  "Mentoring specialistico",
  "Supporto project management"
];

const empty3Company: Section3Company = {
  serviceCategoriesCsv: "",
  servicesDescription: ""
};

type ServiceCategoryDef = {
  id: string;
  label: string;
  services: Array<{ id: string; label: string }>;
};

const SERVICE_CATEGORIES: ServiceCategoryDef[] = [
  {
    id: "CAT_A",
    label: "Categoria A - Formazione, didattica e contenuti",
    services: [
      { id: "TRAINING_DESIGN", label: "Progettazione percorsi formativi" },
      { id: "AULA_TRAINING", label: "Docenza in aula" },
      { id: "ONLINE_SYNC", label: "Formazione sincrona online" },
      { id: "ELEARNING_CONTENT", label: "Produzione contenuti e-learning" },
      { id: "LMS_CONTENT", label: "Contenuti LMS" },
      { id: "LMS_PLATFORM", label: "Gestione piattaforme LMS" },
      { id: "FUNDED_COURSES", label: "Corsi finanziati" },
      { id: "ACTIVE_POLICIES", label: "Politiche attive" },
      { id: "ASSESSMENT", label: "Assessment e valutazione competenze" },
      { id: "SIMULATION", label: "Simulatori / VR / AR per training" },
      { id: "TRANSLATION_LOCALIZATION", label: "Traduzione e localizzazione contenuti" }
    ]
  },
  {
    id: "CAT_B",
    label: "Categoria B - HR, lavoro e organizzazione",
    services: [
      { id: "RECRUITING", label: "Ricerca e selezione personale" },
      { id: "STAFFING", label: "Somministrazione lavoro (APL)" },
      { id: "OUTPLACEMENT", label: "Outplacement" },
      { id: "PAYROLL", label: "Payroll e amministrazione personale" },
      { id: "WELFARE", label: "Welfare aziendale" },
      { id: "HR_CONSULTING", label: "Consulenza organizzativa HR" },
      { id: "ORG_DEVELOPMENT", label: "Sviluppo organizzativo" },
      { id: "COACHING", label: "Coaching manageriale" }
    ]
  },
  {
    id: "CAT_C",
    label: "Categoria C - Tecnologia e digitale",
    services: [
      { id: "CUSTOM_SOFTWARE", label: "Sviluppo software custom" },
      { id: "HRIS", label: "Piattaforme HRIS" },
      { id: "DIGITAL_MARKETING", label: "Digital marketing" },
      { id: "CYBERSECURITY", label: "Cybersecurity" },
      { id: "UX_UI", label: "UX/UI design" },
      { id: "BI_DASHBOARD", label: "Data analysis / BI dashboard" },
      { id: "CLOUD_MANAGED_HELPDESK", label: "Cloud / managed / helpdesk" },
      { id: "AI_AUTOMATION", label: "AI applicata e automazione" }
    ]
  },
  {
    id: "CAT_D",
    label: "Categoria D - Consulenza e compliance",
    services: [
      { id: "LABOR_CONSULTING", label: "Consulenza del lavoro" },
      { id: "LEGAL", label: "Consulenza legale" },
      { id: "TAX_ACCOUNTING", label: "Consulenza fiscale/contabile" },
      { id: "FUNDING", label: "Finanza agevolata e bandi" },
      { id: "STRATEGY", label: "Consulenza strategica" },
      { id: "AUDIT_QUALITY", label: "Audit e sistemi qualita" },
      { id: "GDPR_231_ESG", label: "Compliance GDPR / 231 / ESG" },
      { id: "THIRD_SECTOR_SERVICES", label: "Servizi per terzo settore" },
      { id: "IMPACT_EVALUATION", label: "Valutazione di impatto" }
    ]
  },
  {
    id: "CAT_E",
    label: "Categoria E - Servizi generali e operativi",
    services: [
      { id: "TRAINING_MATERIALS", label: "Materiali formativi" },
      { id: "COMMUNICATION", label: "Comunicazione / grafica / video" },
      { id: "EVENTS", label: "Organizzazione eventi" },
      { id: "LOGISTICS", label: "Logistica e travel management" },
      { id: "FACILITY", label: "Facility management" },
      { id: "CATERING_HOSPITALITY", label: "Catering e hospitality" },
      { id: "AV_RENTAL", label: "Noleggio audio/video" },
      { id: "BACKOFFICE", label: "Servizi backoffice" },
      { id: "TRANSLATION_INTERPRETING", label: "Traduzione e interpretariato" }
    ]
  }
];

const SERVICE_TO_CATEGORY = SERVICE_CATEGORIES.reduce<Record<string, string>>((acc, category) => {
  category.services.forEach((service) => {
    acc[service.id] = category.id;
  });
  return acc;
}, {});

function createEmptyCategorySelection(): Record<string, string[]> {
  return SERVICE_CATEGORIES.reduce<Record<string, string[]>>((acc, category) => {
    acc[category.id] = [];
    return acc;
  }, {});
}

function createEmptyCategoryDescriptions(): Record<string, string> {
  return SERVICE_CATEGORIES.reduce<Record<string, string>>((acc, category) => {
    acc[category.id] = "";
    return acc;
  }, {});
}

function parsePayload<T>(payloadJson?: string | null): T | null {
  if (!payloadJson) return null;
  try {
    return JSON.parse(payloadJson) as T;
  } catch {
    return null;
  }
}

function findSectionByKey(sections: RevampSectionSnapshot[], sectionKey: string): RevampSectionSnapshot | undefined {
  return sections.find((section) => section.sectionKey === sectionKey);
}

function updateArrayItem<T>(items: T[], index: number, updater: (current: T) => T): T[] {
  return items.map((item, itemIndex) => (itemIndex === index ? updater(item) : item));
}

export function RevampApplicationStep3Page() {
  const { applicationId } = useParams();
  const { auth } = useAuth();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [summary, setSummary] = useState<RevampApplicationSummary | null>(null);
  const [branchKey, setBranchKey] = useState<"S3A" | "S3B" | "S3">("S3");
  const [step3A, setStep3A] = useState<Section3A>(empty3A);
  const [step3B, setStep3B] = useState<Section3B>(empty3B);
  const [step3Company, setStep3Company] = useState<Section3Company>(empty3Company);
  const [selectedServicesByCategory, setSelectedServicesByCategory] = useState<Record<string, string[]>>(createEmptyCategorySelection);
  const [serviceDescriptionsByCategory, setServiceDescriptionsByCategory] = useState<Record<string, string>>(createEmptyCategoryDescriptions);
  const [openCategoryId, setOpenCategoryId] = useState<string>(SERVICE_CATEGORIES[0].id);
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
          resumePath: `/application/${applicationId}/step/3`
        });

        const sections = await getRevampApplicationSections(applicationId, auth.token);
        const redirect = resolveStepGuardRedirect(applicationId, appSummary.registryType, sections, "step3");
        setGuardRedirect(redirect);
        const s2 = findSectionByKey(sections, "S2");
        const s2AlboA = parsePayload<Section2AlboA>(s2?.payloadJson);

        let resolvedKey: "S3A" | "S3B" | "S3" = "S3";
        if (appSummary.registryType === "ALBO_A") {
          resolvedKey = s2AlboA?.professionalType === "DOCENTE_FORMATORE" ? "S3A" : "S3B";
        }
        setBranchKey(resolvedKey);

        const target = findSectionByKey(sections, resolvedKey);
        if (resolvedKey === "S3A") {
          const parsed = parsePayload<Section3A>(target?.payloadJson);
          if (parsed) {
            const legacyThematicAreas = (parsed as unknown as { thematicAreasCsv?: string }).thematicAreasCsv ?? "";
            const legacyYearsExperience = (parsed as unknown as { yearsExperience?: string }).yearsExperience ?? "";
            const legacyPresentation = (parsed as unknown as { presentation?: string }).presentation ?? "";
            setStep3A({
              education: {
                highestTitle: parsed.education?.highestTitle ?? "",
                studyArea: parsed.education?.studyArea ?? "",
                graduationYear: parsed.education?.graduationYear ?? ""
              },
              certifications: parsed.certifications && parsed.certifications.length > 0
                ? parsed.certifications
                : [{ name: "", issuer: "", year: "" }],
              competencies: parsed.competencies && parsed.competencies.length > 0
                ? parsed.competencies
                : [{
                    theme: legacyThematicAreas,
                    details: legacyPresentation,
                    yearsBand: legacyYearsExperience
                  }],
              paTeachingExperience: Boolean(parsed.paTeachingExperience),
              consultingAreasCsv: parsed.consultingAreasCsv ?? "",
              territoryRegionsCsv: parsed.territoryRegionsCsv ?? "",
              territoryProvincesCsv: parsed.territoryProvincesCsv ?? "",
              languages: parsed.languages && parsed.languages.length > 0
                ? parsed.languages
                : [{ language: "", qcerLevel: "" }],
              teachingLanguagesCsv: parsed.teachingLanguagesCsv ?? "",
              digitalToolsCsv: parsed.digitalToolsCsv ?? "",
              professionalNetworksCsv: parsed.professionalNetworksCsv ?? "",
              availability: {
                travelAvailable: Boolean(parsed.availability?.travelAvailable),
                dailyRateRange: parsed.availability?.dailyRateRange ?? "",
                hourlyRateRange: parsed.availability?.hourlyRateRange ?? ""
              },
              experiences: parsed.experiences && parsed.experiences.length > 0
                ? parsed.experiences
                : [{
                    clientName: "",
                    clientSector: "",
                    interventionType: "",
                    mainTheme: "",
                    periodFrom: "",
                    periodTo: "",
                    durationHours: "",
                    participantsCount: "",
                    deliveryMode: "",
                    fundedIntervention: false,
                    fundName: ""
                  }]
            });
          }
        } else if (resolvedKey === "S3B") {
          const parsed = parsePayload<Section3B>(target?.payloadJson);
          if (parsed) {
            const legacy = parsed as unknown as { specialization?: string; operationalScope?: string };
            const legacyServices = legacy.specialization
              ? legacy.specialization.split(",").map((item) => item.trim()).filter(Boolean)
              : [];
            setStep3B({
              professionalOrder: parsed.professionalOrder ?? "",
              highestTitle: parsed.highestTitle ?? "",
              studyArea: parsed.studyArea ?? "",
              experienceBand: parsed.experienceBand ?? "",
              services: parsed.services && parsed.services.length > 0 ? parsed.services : legacyServices,
              territory: {
                regionsCsv: parsed.territory?.regionsCsv ?? "",
                provincesCsv: parsed.territory?.provincesCsv ?? (legacy.operationalScope ?? "")
              },
              hourlyRateRange: parsed.hourlyRateRange ?? "",
              specificCertifications: parsed.specificCertifications && parsed.specificCertifications.length > 0
                ? parsed.specificCertifications
                : [{ name: "", issuer: "", year: "" }]
            });
          }
        } else {
          const parsed = parsePayload<Section3Company>(target?.payloadJson);
          const nextSelected = createEmptyCategorySelection();
          const nextDescriptions = createEmptyCategoryDescriptions();

          if (parsed) {
            setStep3Company({
              serviceCategoriesCsv: parsed.serviceCategoriesCsv ?? "",
              servicesDescription: parsed.servicesDescription ?? "",
              servicesByCategory: parsed.servicesByCategory ?? {},
              descriptionsByCategory: parsed.descriptionsByCategory ?? {}
            });

            if (parsed.servicesByCategory) {
              SERVICE_CATEGORIES.forEach((category) => {
                const selected = parsed.servicesByCategory?.[category.id] ?? [];
                nextSelected[category.id] = selected.filter((value) => SERVICE_TO_CATEGORY[value] === category.id);
              });
            } else {
              (parsed.serviceCategoriesCsv ?? "")
                .split(",")
                .map((value) => value.trim())
                .filter(Boolean)
                .forEach((serviceId) => {
                  const categoryId = SERVICE_TO_CATEGORY[serviceId];
                  if (categoryId && !nextSelected[categoryId].includes(serviceId)) {
                    nextSelected[categoryId] = [...nextSelected[categoryId], serviceId];
                  }
                });
            }

            if (parsed.descriptionsByCategory) {
              SERVICE_CATEGORIES.forEach((category) => {
                nextDescriptions[category.id] = parsed.descriptionsByCategory?.[category.id] ?? "";
              });
            }
          }
          setSelectedServicesByCategory(nextSelected);
          setServiceDescriptionsByCategory(nextDescriptions);
        }

        if (target?.updatedAt) {
          setLastSavedAt(new Date(target.updatedAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }));
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

  function validate(type: RevampRegistryType, key: "S3A" | "S3B" | "S3"): FieldErrors {
    if (type === "ALBO_A" && key === "S3A") {
      const next: FieldErrors = {};
      if (!step3A.education.highestTitle.trim()) next.educationHighestTitle = "Titolo di studio obbligatorio.";
      if (!step3A.education.studyArea.trim()) next.educationStudyArea = "Ambito di studio obbligatorio.";
      if (!step3A.education.graduationYear.trim()) next.educationGraduationYear = "Anno conseguimento obbligatorio.";
      const hasCompetency = step3A.competencies.some((item) => item.theme.trim() && item.details.trim() && item.yearsBand.trim());
      if (!hasCompetency) next.competencies = "Inserire almeno una competenza completa (tema, dettagli, esperienza).";
      if (step3A.experiences.length > 5) next.experiences = "Massimo 5 esperienze consentite.";
      step3A.experiences.forEach((exp, idx) => {
        if (!exp.clientName.trim() || !exp.interventionType.trim() || !exp.mainTheme.trim()) {
          next[`exp_${idx}`] = `Esperienza ${idx + 1}: compilare committente, tipo intervento e ambito principale.`;
        }
      });
      return next;
    }

    if (type === "ALBO_A" && key === "S3B") {
      const next: FieldErrors = {};
      if (!step3B.professionalOrder.trim()) next.professionalOrder = "Ordine professionale obbligatorio.";
      if (!step3B.highestTitle.trim()) next.highestTitle = "Titolo di studio obbligatorio.";
      if (!step3B.studyArea.trim()) next.studyArea = "Ambito di studio obbligatorio.";
      if (!step3B.experienceBand.trim()) next.experienceBand = "Fascia esperienza obbligatoria.";
      if (step3B.services.length === 0) next.services = "Selezionare almeno un servizio.";
      if (!step3B.territory.regionsCsv.trim() && !step3B.territory.provincesCsv.trim()) {
        next.territory = "Territorio operativo obbligatorio.";
      }
      if (!step3B.hourlyRateRange.trim()) next.hourlyRateRange = "Range tariffa oraria obbligatorio.";
      return next;
    }

    const next: FieldErrors = {};
    const totalSelected = Object.values(selectedServicesByCategory).reduce((sum, selected) => sum + selected.length, 0);
    if (totalSelected === 0) next.serviceCategoriesCsv = t("revamp.step3.error.serviceCategoriesRequired");
    SERVICE_CATEGORIES.forEach((category) => {
      const selectedCount = selectedServicesByCategory[category.id]?.length ?? 0;
      const description = serviceDescriptionsByCategory[category.id] ?? "";
      if (selectedCount > 0 && !description.trim()) {
        next[`servicesDescription_${category.id}`] = t("revamp.step3.error.servicesDescriptionRequired");
      } else if (description.trim().length > 400) {
        next[`servicesDescription_${category.id}`] = "Massimo 400 caratteri per descrizione categoria.";
      }
    });
    return next;
  }

  function toggleCompanyService(categoryId: string, serviceId: string) {
    setSelectedServicesByCategory((prev) => {
      const current = prev[categoryId] ?? [];
      const next = current.includes(serviceId)
        ? current.filter((value) => value !== serviceId)
        : [...current, serviceId];
      return { ...prev, [categoryId]: next };
    });
    markDirty();
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (!applicationId || !auth?.token || !registryType) return;

    const validationErrors = validate(registryType, branchKey);
    setErrors(validationErrors);
    const completed = Object.keys(validationErrors).length === 0;
    let payload: Section3A | Section3B | Section3Company = step3Company;
    if (branchKey === "S3A") {
      const certifications = step3A.certifications
        .map((item) => ({ ...item, name: item.name.trim(), issuer: item.issuer.trim(), year: item.year.trim() }))
        .filter((item) => item.name || item.issuer || item.year);
      const competencies = step3A.competencies
        .map((item) => ({ ...item, theme: item.theme.trim(), details: item.details.trim(), yearsBand: item.yearsBand.trim() }))
        .filter((item) => item.theme || item.details || item.yearsBand);
      const languages = step3A.languages
        .map((item) => ({ ...item, language: item.language.trim(), qcerLevel: item.qcerLevel.trim() }))
        .filter((item) => item.language || item.qcerLevel);
      const experiences = step3A.experiences
        .map((item) => ({
          ...item,
          clientName: item.clientName.trim(),
          clientSector: item.clientSector.trim(),
          interventionType: item.interventionType.trim(),
          mainTheme: item.mainTheme.trim(),
          periodFrom: item.periodFrom.trim(),
          periodTo: item.periodTo.trim(),
          durationHours: item.durationHours.trim(),
          participantsCount: item.participantsCount.trim(),
          deliveryMode: item.deliveryMode.trim(),
          fundName: item.fundName.trim()
        }))
        .filter((item) => item.clientName || item.interventionType || item.mainTheme);
      payload = step3A;
      payload = {
        ...step3A,
        certifications,
        competencies,
        languages,
        experiences
      };
    } else if (branchKey === "S3B") {
      const specificCertifications = step3B.specificCertifications
        .map((item) => ({ name: item.name.trim(), issuer: item.issuer.trim(), year: item.year.trim() }))
        .filter((item) => item.name || item.issuer || item.year);
      payload = {
        ...step3B,
        professionalOrder: step3B.professionalOrder.trim(),
        highestTitle: step3B.highestTitle.trim(),
        studyArea: step3B.studyArea.trim(),
        experienceBand: step3B.experienceBand.trim(),
        services: step3B.services.map((item) => item.trim()).filter(Boolean),
        territory: {
          regionsCsv: step3B.territory.regionsCsv.trim(),
          provincesCsv: step3B.territory.provincesCsv.trim()
        },
        hourlyRateRange: step3B.hourlyRateRange.trim(),
        specificCertifications
      };
    } else {
      const serviceIds = SERVICE_CATEGORIES.flatMap((category) => selectedServicesByCategory[category.id] ?? []);
      const nonEmptyDescriptions = SERVICE_CATEGORIES.reduce<Record<string, string>>((acc, category) => {
        const value = (serviceDescriptionsByCategory[category.id] ?? "").trim();
        if (value) acc[category.id] = value;
        return acc;
      }, {});
      payload = {
        serviceCategoriesCsv: serviceIds.join(","),
        servicesDescription: Object.entries(nonEmptyDescriptions).map(([categoryId, value]) => `${categoryId}: ${value}`).join("\n"),
        servicesByCategory: selectedServicesByCategory,
        descriptionsByCategory: nonEmptyDescriptions
      };
    }

    setSaveState("saving");
    try {
      const saved = await saveRevampApplicationSection(
        applicationId,
        branchKey,
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
          <h2>{t("revamp.step3.loading")}</h2>
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

  if (guardRedirect && guardRedirect !== `/application/${applicationId}/step/3`) {
    return <Navigate to={guardRedirect} replace />;
  }

  const title =
    branchKey === "S3A"
      ? t("revamp.step3.title.s3a")
      : branchKey === "S3B"
        ? t("revamp.step3.title.s3b")
        : t("revamp.step3.title.s3");

  return (
    <section className="stack">
      <div className="panel revamp-step-header">
        <h2>{title}</h2>
        <p className="subtle">
          {t("revamp.step.common.subtitle", { id: applicationId, state: saveLabel })}
        </p>
      </div>

      <form className="panel stack" onSubmit={onSave}>
        {branchKey === "S3A" ? (
          <>
            <h3 className="revamp-step-subtitle"><GraduationCap className="h-4 w-4" /> {t("revamp.step3.s3a.sectionTitle")}</h3>
            <div className="grid-form">
              <label className={`floating-field ${step3A.education.highestTitle ? "has-value" : ""}`}>
                <input
                  className="floating-input auth-input"
                  value={step3A.education.highestTitle}
                  onChange={(e) => {
                    const value = e.target.value;
                    setStep3A((prev) => ({ ...prev, education: { ...prev.education, highestTitle: value } }));
                    markDirty();
                  }}
                  placeholder=" "
                />
                <span className="floating-field-label">Titolo di studio piu elevato *</span>
              </label>
              <label className={`floating-field ${step3A.education.studyArea ? "has-value" : ""}`}>
                <input
                  className="floating-input auth-input"
                  value={step3A.education.studyArea}
                  onChange={(e) => {
                    const value = e.target.value;
                    setStep3A((prev) => ({ ...prev, education: { ...prev.education, studyArea: value } }));
                    markDirty();
                  }}
                  placeholder=" "
                />
                <span className="floating-field-label">Ambito / indirizzo di studio *</span>
              </label>
              <label className={`floating-field ${step3A.education.graduationYear ? "has-value" : ""}`}>
                <input
                  className="floating-input auth-input"
                  value={step3A.education.graduationYear}
                  onChange={(e) => {
                    const value = e.target.value;
                    setStep3A((prev) => ({ ...prev, education: { ...prev.education, graduationYear: value } }));
                    markDirty();
                  }}
                  placeholder=" "
                />
                <span className="floating-field-label">Anno conseguimento *</span>
              </label>
            </div>
            <div className="home-step-card">
              <div className="home-step-head">
                <span className="home-step-index">C</span>
                <h4>Competenze e anni esperienza</h4>
              </div>
              <div className="stack">
                {step3A.competencies.map((item, index) => (
                  <div key={`cmp-${index}`} className="grid-form">
                    <label className={`floating-field ${item.theme ? "has-value" : ""}`}>
                      <input
                        className="floating-input auth-input"
                        value={item.theme}
                        onChange={(e) => {
                          const value = e.target.value;
                          setStep3A((prev) => ({ ...prev, competencies: updateArrayItem(prev.competencies, index, (curr) => ({ ...curr, theme: value })) }));
                          markDirty();
                        }}
                        placeholder=" "
                      />
                      <span className="floating-field-label">Tema *</span>
                    </label>
                    <label className={`floating-field ${item.details ? "has-value" : ""}`}>
                      <input
                        className="floating-input auth-input"
                        value={item.details}
                        onChange={(e) => {
                          const value = e.target.value;
                          setStep3A((prev) => ({ ...prev, competencies: updateArrayItem(prev.competencies, index, (curr) => ({ ...curr, details: value })) }));
                          markDirty();
                        }}
                        placeholder=" "
                      />
                      <span className="floating-field-label">Dettagli *</span>
                    </label>
                    <label className="floating-field has-value">
                      <select
                        className="floating-input auth-input"
                        value={item.yearsBand}
                        onChange={(e) => {
                          const value = e.target.value;
                          setStep3A((prev) => ({ ...prev, competencies: updateArrayItem(prev.competencies, index, (curr) => ({ ...curr, yearsBand: value })) }));
                          markDirty();
                        }}
                      >
                        <option value="">Esperienza *</option>
                        <option value="LT_1">{"< 1 anno"}</option>
                        <option value="Y1_3">1-3 anni</option>
                        <option value="Y3_5">3-5 anni</option>
                        <option value="Y5_10">5-10 anni</option>
                        <option value="Y10_15">10-15 anni</option>
                        <option value="GT_15">{"> 15 anni"}</option>
                      </select>
                      <span className="floating-field-label">Fascia esperienza *</span>
                    </label>
                    <button
                      type="button"
                      className="home-btn home-btn-secondary"
                      onClick={() => {
                        setStep3A((prev) => ({
                          ...prev,
                          competencies: prev.competencies.length > 1 ? prev.competencies.filter((_, i) => i !== index) : prev.competencies
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
                    setStep3A((prev) => ({
                      ...prev,
                      competencies: [...prev.competencies, { theme: "", details: "", yearsBand: "" }]
                    }));
                    markDirty();
                  }}
                >
                  + Aggiungi competenza
                </button>
              </div>
            </div>

            <div className="grid-form">
              <label className={`floating-field ${step3A.consultingAreasCsv ? "has-value" : ""}`}>
                <input
                  className="floating-input auth-input"
                  value={step3A.consultingAreasCsv}
                  onChange={(e) => {
                    const value = e.target.value;
                    setStep3A((prev) => ({ ...prev, consultingAreasCsv: value }));
                    markDirty();
                  }}
                  placeholder=" "
                />
                <span className="floating-field-label">Ambiti consulenza (CSV)</span>
              </label>
              <label className={`floating-field ${step3A.territoryRegionsCsv ? "has-value" : ""}`}>
                <input
                  className="floating-input auth-input"
                  value={step3A.territoryRegionsCsv}
                  onChange={(e) => {
                    const value = e.target.value;
                    setStep3A((prev) => ({ ...prev, territoryRegionsCsv: value }));
                    markDirty();
                  }}
                  placeholder=" "
                />
                <span className="floating-field-label">Regioni operative (CSV)</span>
              </label>
              <label className={`floating-field ${step3A.territoryProvincesCsv ? "has-value" : ""}`}>
                <input
                  className="floating-input auth-input"
                  value={step3A.territoryProvincesCsv}
                  onChange={(e) => {
                    const value = e.target.value;
                    setStep3A((prev) => ({ ...prev, territoryProvincesCsv: value }));
                    markDirty();
                  }}
                  placeholder=" "
                />
                <span className="floating-field-label">Province operative (CSV)</span>
              </label>
            </div>

            <div className="home-step-card">
              <div className="home-step-head">
                <span className="home-step-index">L</span>
                <h4>Lingue</h4>
              </div>
              <div className="stack">
                {step3A.languages.map((item, index) => (
                  <div key={`lng-${index}`} className="grid-form">
                    <label className={`floating-field ${item.language ? "has-value" : ""}`}>
                      <input
                        className="floating-input auth-input"
                        value={item.language}
                        onChange={(e) => {
                          const value = e.target.value;
                          setStep3A((prev) => ({ ...prev, languages: updateArrayItem(prev.languages, index, (curr) => ({ ...curr, language: value })) }));
                          markDirty();
                        }}
                        placeholder=" "
                      />
                      <span className="floating-field-label">Lingua</span>
                    </label>
                    <label className="floating-field has-value">
                      <select
                        className="floating-input auth-input"
                        value={item.qcerLevel}
                        onChange={(e) => {
                          const value = e.target.value;
                          setStep3A((prev) => ({ ...prev, languages: updateArrayItem(prev.languages, index, (curr) => ({ ...curr, qcerLevel: value })) }));
                          markDirty();
                        }}
                      >
                        <option value="">QCER</option>
                        <option value="A1">A1</option>
                        <option value="A2">A2</option>
                        <option value="B1">B1</option>
                        <option value="B2">B2</option>
                        <option value="C1">C1</option>
                        <option value="C2">C2</option>
                        <option value="NATIVE">Madrelingua</option>
                      </select>
                      <span className="floating-field-label">Livello QCER</span>
                    </label>
                    <button
                      type="button"
                      className="home-btn home-btn-secondary"
                      onClick={() => {
                        setStep3A((prev) => ({
                          ...prev,
                          languages: prev.languages.length > 1 ? prev.languages.filter((_, i) => i !== index) : prev.languages
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
                    setStep3A((prev) => ({ ...prev, languages: [...prev.languages, { language: "", qcerLevel: "" }] }));
                    markDirty();
                  }}
                >
                  + Aggiungi lingua
                </button>
              </div>
            </div>

            <div className="grid-form">
              <label className={`floating-field ${step3A.teachingLanguagesCsv ? "has-value" : ""}`}>
                <input
                  className="floating-input auth-input"
                  value={step3A.teachingLanguagesCsv}
                  onChange={(e) => {
                    const value = e.target.value;
                    setStep3A((prev) => ({ ...prev, teachingLanguagesCsv: value }));
                    markDirty();
                  }}
                  placeholder=" "
                />
                <span className="floating-field-label">Lingue docenza (CSV)</span>
              </label>
              <label className={`floating-field ${step3A.digitalToolsCsv ? "has-value" : ""}`}>
                <input
                  className="floating-input auth-input"
                  value={step3A.digitalToolsCsv}
                  onChange={(e) => {
                    const value = e.target.value;
                    setStep3A((prev) => ({ ...prev, digitalToolsCsv: value }));
                    markDirty();
                  }}
                  placeholder=" "
                />
                <span className="floating-field-label">Strumenti digitali (CSV)</span>
              </label>
              <label className={`floating-field ${step3A.professionalNetworksCsv ? "has-value" : ""}`}>
                <input
                  className="floating-input auth-input"
                  value={step3A.professionalNetworksCsv}
                  onChange={(e) => {
                    const value = e.target.value;
                    setStep3A((prev) => ({ ...prev, professionalNetworksCsv: value }));
                    markDirty();
                  }}
                  placeholder=" "
                />
                <span className="floating-field-label">Reti/associazioni (CSV)</span>
              </label>
            </div>

            <div className="home-step-card">
              <div className="home-step-head">
                <span className="home-step-index">A</span>
                <h4>Disponibilita e tariffe</h4>
              </div>
              <label className="review-check-item">
                <input
                  type="checkbox"
                  checked={step3A.availability.travelAvailable}
                  onChange={(e) => {
                    const value = e.target.checked;
                    setStep3A((prev) => ({ ...prev, availability: { ...prev.availability, travelAvailable: value } }));
                    markDirty();
                  }}
                />
                <span>Disponibile a trasferte</span>
              </label>
              <div className="grid-form">
                <label className={`floating-field ${step3A.availability.dailyRateRange ? "has-value" : ""}`}>
                  <input
                    className="floating-input auth-input"
                    value={step3A.availability.dailyRateRange}
                    onChange={(e) => {
                      const value = e.target.value;
                      setStep3A((prev) => ({ ...prev, availability: { ...prev.availability, dailyRateRange: value } }));
                      markDirty();
                    }}
                    placeholder=" "
                  />
                  <span className="floating-field-label">Tariffa giornaliera (range)</span>
                </label>
                <label className={`floating-field ${step3A.availability.hourlyRateRange ? "has-value" : ""}`}>
                  <input
                    className="floating-input auth-input"
                    value={step3A.availability.hourlyRateRange}
                    onChange={(e) => {
                      const value = e.target.value;
                      setStep3A((prev) => ({ ...prev, availability: { ...prev.availability, hourlyRateRange: value } }));
                      markDirty();
                    }}
                    placeholder=" "
                  />
                  <span className="floating-field-label">Tariffa oraria (range)</span>
                </label>
              </div>
            </div>

            <div className="home-step-card">
              <div className="home-step-head">
                <span className="home-step-index">E</span>
                <h4>Esperienze formative (max 5)</h4>
              </div>
              <div className="stack">
                {step3A.experiences.map((exp, index) => (
                  <div key={`exp-${index}`} className="home-step-card">
                    <div className="grid-form">
                      <label className={`floating-field ${exp.clientName ? "has-value" : ""}`}>
                        <input
                          className="floating-input auth-input"
                          value={exp.clientName}
                          onChange={(e) => {
                            const value = e.target.value;
                            setStep3A((prev) => ({ ...prev, experiences: updateArrayItem(prev.experiences, index, (curr) => ({ ...curr, clientName: value })) }));
                            markDirty();
                          }}
                          placeholder=" "
                        />
                        <span className="floating-field-label">Committente *</span>
                      </label>
                      <label className={`floating-field ${exp.clientSector ? "has-value" : ""}`}>
                        <input
                          className="floating-input auth-input"
                          value={exp.clientSector}
                          onChange={(e) => {
                            const value = e.target.value;
                            setStep3A((prev) => ({ ...prev, experiences: updateArrayItem(prev.experiences, index, (curr) => ({ ...curr, clientSector: value })) }));
                            markDirty();
                          }}
                          placeholder=" "
                        />
                        <span className="floating-field-label">Settore committente</span>
                      </label>
                      <label className={`floating-field ${exp.interventionType ? "has-value" : ""}`}>
                        <input
                          className="floating-input auth-input"
                          value={exp.interventionType}
                          onChange={(e) => {
                            const value = e.target.value;
                            setStep3A((prev) => ({ ...prev, experiences: updateArrayItem(prev.experiences, index, (curr) => ({ ...curr, interventionType: value })) }));
                            markDirty();
                          }}
                          placeholder=" "
                        />
                        <span className="floating-field-label">Tipo intervento *</span>
                      </label>
                      <label className={`floating-field ${exp.mainTheme ? "has-value" : ""}`}>
                        <input
                          className="floating-input auth-input"
                          value={exp.mainTheme}
                          onChange={(e) => {
                            const value = e.target.value;
                            setStep3A((prev) => ({ ...prev, experiences: updateArrayItem(prev.experiences, index, (curr) => ({ ...curr, mainTheme: value })) }));
                            markDirty();
                          }}
                          placeholder=" "
                        />
                        <span className="floating-field-label">Ambito principale *</span>
                      </label>
                      <label className={`floating-field ${exp.periodFrom ? "has-value" : ""}`}>
                        <input
                          className="floating-input auth-input"
                          type="date"
                          value={exp.periodFrom}
                          onChange={(e) => {
                            const value = e.target.value;
                            setStep3A((prev) => ({ ...prev, experiences: updateArrayItem(prev.experiences, index, (curr) => ({ ...curr, periodFrom: value })) }));
                            markDirty();
                          }}
                          placeholder=" "
                        />
                        <span className="floating-field-label">Periodo da</span>
                      </label>
                      <label className={`floating-field ${exp.periodTo ? "has-value" : ""}`}>
                        <input
                          className="floating-input auth-input"
                          type="date"
                          value={exp.periodTo}
                          onChange={(e) => {
                            const value = e.target.value;
                            setStep3A((prev) => ({ ...prev, experiences: updateArrayItem(prev.experiences, index, (curr) => ({ ...curr, periodTo: value })) }));
                            markDirty();
                          }}
                          placeholder=" "
                        />
                        <span className="floating-field-label">Periodo a</span>
                      </label>
                      <label className={`floating-field ${exp.durationHours ? "has-value" : ""}`}>
                        <input
                          className="floating-input auth-input"
                          value={exp.durationHours}
                          onChange={(e) => {
                            const value = e.target.value;
                            setStep3A((prev) => ({ ...prev, experiences: updateArrayItem(prev.experiences, index, (curr) => ({ ...curr, durationHours: value })) }));
                            markDirty();
                          }}
                          placeholder=" "
                        />
                        <span className="floating-field-label">Durata ore</span>
                      </label>
                      <label className={`floating-field ${exp.participantsCount ? "has-value" : ""}`}>
                        <input
                          className="floating-input auth-input"
                          value={exp.participantsCount}
                          onChange={(e) => {
                            const value = e.target.value;
                            setStep3A((prev) => ({ ...prev, experiences: updateArrayItem(prev.experiences, index, (curr) => ({ ...curr, participantsCount: value })) }));
                            markDirty();
                          }}
                          placeholder=" "
                        />
                        <span className="floating-field-label">Partecipanti</span>
                      </label>
                      <label className="floating-field has-value">
                        <select
                          className="floating-input auth-input"
                          value={exp.deliveryMode}
                          onChange={(e) => {
                            const value = e.target.value;
                            setStep3A((prev) => ({ ...prev, experiences: updateArrayItem(prev.experiences, index, (curr) => ({ ...curr, deliveryMode: value })) }));
                            markDirty();
                          }}
                        >
                          <option value="">Modalita erogazione</option>
                          <option value="IN_PRESENCE">In presenza</option>
                          <option value="ONLINE">Online</option>
                          <option value="BLENDED">Blended</option>
                        </select>
                        <span className="floating-field-label">Modalita</span>
                      </label>
                      <label className="review-check-item">
                        <input
                          type="checkbox"
                          checked={exp.fundedIntervention}
                          onChange={(e) => {
                            const value = e.target.checked;
                            setStep3A((prev) => ({ ...prev, experiences: updateArrayItem(prev.experiences, index, (curr) => ({ ...curr, fundedIntervention: value })) }));
                            markDirty();
                          }}
                        />
                        <span>Intervento finanziato</span>
                      </label>
                      <label className={`floating-field ${exp.fundName ? "has-value" : ""}`}>
                        <input
                          className="floating-input auth-input"
                          value={exp.fundName}
                          onChange={(e) => {
                            const value = e.target.value;
                            setStep3A((prev) => ({ ...prev, experiences: updateArrayItem(prev.experiences, index, (curr) => ({ ...curr, fundName: value })) }));
                            markDirty();
                          }}
                          placeholder=" "
                        />
                        <span className="floating-field-label">Fondo (se finanziato)</span>
                      </label>
                    </div>
                    <button
                      type="button"
                      className="home-btn home-btn-secondary"
                      onClick={() => {
                        setStep3A((prev) => ({
                          ...prev,
                          experiences: prev.experiences.length > 1 ? prev.experiences.filter((_, i) => i !== index) : prev.experiences
                        }));
                        markDirty();
                      }}
                    >
                      Rimuovi esperienza
                    </button>
                    {errors[`exp_${index}`] ? <p className="error">{errors[`exp_${index}`]}</p> : null}
                  </div>
                ))}
                <button
                  type="button"
                  className="home-btn home-btn-secondary"
                  disabled={step3A.experiences.length >= 5}
                  onClick={() => {
                    setStep3A((prev) => ({
                      ...prev,
                      experiences: [
                        ...prev.experiences,
                        {
                          clientName: "",
                          clientSector: "",
                          interventionType: "",
                          mainTheme: "",
                          periodFrom: "",
                          periodTo: "",
                          durationHours: "",
                          participantsCount: "",
                          deliveryMode: "",
                          fundedIntervention: false,
                          fundName: ""
                        }
                      ]
                    }));
                    markDirty();
                  }}
                >
                  + Aggiungi esperienza
                </button>
              </div>
            </div>

            {errors.educationHighestTitle ? <p className="error">{errors.educationHighestTitle}</p> : null}
            {errors.educationStudyArea ? <p className="error">{errors.educationStudyArea}</p> : null}
            {errors.educationGraduationYear ? <p className="error">{errors.educationGraduationYear}</p> : null}
            {errors.competencies ? <p className="error">{errors.competencies}</p> : null}
            {errors.experiences ? <p className="error">{errors.experiences}</p> : null}
          </>
        ) : null}

        {branchKey === "S3B" ? (
          <>
            <h3 className="revamp-step-subtitle"><Wrench className="h-4 w-4" /> {t("revamp.step3.s3b.sectionTitle")}</h3>
            <div className="grid-form">
              <label className={`floating-field ${step3B.professionalOrder ? "has-value" : ""}`}>
                <input
                  className="floating-input auth-input"
                  value={step3B.professionalOrder}
                  onChange={(e) => {
                    setStep3B((prev) => ({ ...prev, professionalOrder: e.target.value }));
                    markDirty();
                  }}
                  placeholder=" "
                />
                <span className="floating-field-label">Ordine professionale *</span>
              </label>
              <label className={`floating-field ${step3B.highestTitle ? "has-value" : ""}`}>
                <input
                  className="floating-input auth-input"
                  value={step3B.highestTitle}
                  onChange={(e) => {
                    setStep3B((prev) => ({ ...prev, highestTitle: e.target.value }));
                    markDirty();
                  }}
                  placeholder=" "
                />
                <span className="floating-field-label">Titolo di studio *</span>
              </label>
              <label className={`floating-field ${step3B.studyArea ? "has-value" : ""}`}>
                <input
                  className="floating-input auth-input"
                  value={step3B.studyArea}
                  onChange={(e) => {
                    setStep3B((prev) => ({ ...prev, studyArea: e.target.value }));
                    markDirty();
                  }}
                  placeholder=" "
                />
                <span className="floating-field-label">Ambito di studio *</span>
              </label>
              <label className={`floating-field ${step3B.experienceBand ? "has-value" : ""}`}>
                <select
                  className="floating-input auth-input"
                  value={step3B.experienceBand}
                  onChange={(e) => {
                    setStep3B((prev) => ({ ...prev, experienceBand: e.target.value }));
                    markDirty();
                  }}
                >
                  <option value="">Fascia esperienza</option>
                  <option value="Y0_3">0-3 anni</option>
                  <option value="Y4_7">4-7 anni</option>
                  <option value="Y8_15">8-15 anni</option>
                  <option value="Y15_PLUS">oltre 15 anni</option>
                </select>
                <span className="floating-field-label">Fascia esperienza *</span>
              </label>
              <label className={`floating-field ${step3B.hourlyRateRange ? "has-value" : ""}`}>
                <input
                  className="floating-input auth-input"
                  value={step3B.hourlyRateRange}
                  onChange={(e) => {
                    setStep3B((prev) => ({ ...prev, hourlyRateRange: e.target.value }));
                    markDirty();
                  }}
                  placeholder=" "
                />
                <span className="floating-field-label">Range tariffa oraria *</span>
              </label>
              <label className={`floating-field ${step3B.territory.regionsCsv ? "has-value" : ""}`}>
                <input
                  className="floating-input auth-input"
                  value={step3B.territory.regionsCsv}
                  onChange={(e) => {
                    const value = e.target.value;
                    setStep3B((prev) => ({ ...prev, territory: { ...prev.territory, regionsCsv: value } }));
                    markDirty();
                  }}
                  placeholder=" "
                />
                <span className="floating-field-label">Regioni operative (CSV) *</span>
              </label>
              <label className={`floating-field ${step3B.territory.provincesCsv ? "has-value" : ""}`}>
                <input
                  className="floating-input auth-input"
                  value={step3B.territory.provincesCsv}
                  onChange={(e) => {
                    const value = e.target.value;
                    setStep3B((prev) => ({ ...prev, territory: { ...prev.territory, provincesCsv: value } }));
                    markDirty();
                  }}
                  placeholder=" "
                />
                <span className="floating-field-label">Province operative (CSV)</span>
              </label>
            </div>
            <div className="home-step-card">
              <div className="home-step-head">
                <span className="home-step-index">S</span>
                <h4>Servizi offerti *</h4>
              </div>
              <div className="grid-form" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                {S3B_SERVICE_OPTIONS.map((service) => {
                  const checked = step3B.services.includes(service);
                  return (
                    <label key={service} className="review-check-item">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setStep3B((prev) => ({
                            ...prev,
                            services: checked
                              ? prev.services.filter((item) => item !== service)
                              : [...prev.services, service]
                          }));
                          markDirty();
                        }}
                      />
                      <span>{service}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="home-step-card">
              <div className="home-step-head">
                <span className="home-step-index">C</span>
                <h4>Certificazioni specifiche</h4>
              </div>
              <div className="stack">
                {step3B.specificCertifications.map((certification, index) => (
                  <div key={`s3b-cert-${index}`} className="grid-form">
                    <label className={`floating-field ${certification.name ? "has-value" : ""}`}>
                      <input
                        className="floating-input auth-input"
                        value={certification.name}
                        onChange={(e) => {
                          const value = e.target.value;
                          setStep3B((prev) => ({
                            ...prev,
                            specificCertifications: updateArrayItem(prev.specificCertifications, index, (curr) => ({ ...curr, name: value }))
                          }));
                          markDirty();
                        }}
                        placeholder=" "
                      />
                      <span className="floating-field-label">Nome certificazione</span>
                    </label>
                    <label className={`floating-field ${certification.issuer ? "has-value" : ""}`}>
                      <input
                        className="floating-input auth-input"
                        value={certification.issuer}
                        onChange={(e) => {
                          const value = e.target.value;
                          setStep3B((prev) => ({
                            ...prev,
                            specificCertifications: updateArrayItem(prev.specificCertifications, index, (curr) => ({ ...curr, issuer: value }))
                          }));
                          markDirty();
                        }}
                        placeholder=" "
                      />
                      <span className="floating-field-label">Ente</span>
                    </label>
                    <label className={`floating-field ${certification.year ? "has-value" : ""}`}>
                      <input
                        className="floating-input auth-input"
                        value={certification.year}
                        onChange={(e) => {
                          const value = e.target.value;
                          setStep3B((prev) => ({
                            ...prev,
                            specificCertifications: updateArrayItem(prev.specificCertifications, index, (curr) => ({ ...curr, year: value }))
                          }));
                          markDirty();
                        }}
                        placeholder=" "
                      />
                      <span className="floating-field-label">Anno</span>
                    </label>
                    <button
                      type="button"
                      className="home-btn home-btn-secondary"
                      onClick={() => {
                        setStep3B((prev) => ({
                          ...prev,
                          specificCertifications: prev.specificCertifications.length > 1
                            ? prev.specificCertifications.filter((_, idx) => idx !== index)
                            : prev.specificCertifications
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
                    setStep3B((prev) => ({
                      ...prev,
                      specificCertifications: [...prev.specificCertifications, { name: "", issuer: "", year: "" }]
                    }));
                    markDirty();
                  }}
                >
                  + Aggiungi certificazione
                </button>
              </div>
            </div>
            {errors.professionalOrder ? <p className="error">{errors.professionalOrder}</p> : null}
            {errors.highestTitle ? <p className="error">{errors.highestTitle}</p> : null}
            {errors.studyArea ? <p className="error">{errors.studyArea}</p> : null}
            {errors.experienceBand ? <p className="error">{errors.experienceBand}</p> : null}
            {errors.services ? <p className="error">{errors.services}</p> : null}
            {errors.territory ? <p className="error">{errors.territory}</p> : null}
            {errors.hourlyRateRange ? <p className="error">{errors.hourlyRateRange}</p> : null}
          </>
        ) : null}

        {branchKey === "S3" ? (
          <>
            <h3 className="revamp-step-subtitle"><Building2 className="h-4 w-4" /> {t("revamp.step3.s3.sectionTitle")}</h3>
            <p className="subtle">Seleziona i servizi per categoria. Per ogni categoria attivata, la descrizione e obbligatoria.</p>
            <div className="stack">
              {SERVICE_CATEGORIES.map((category) => {
                const selected = selectedServicesByCategory[category.id] ?? [];
                const description = serviceDescriptionsByCategory[category.id] ?? "";
                const isOpen = openCategoryId === category.id;
                const hasDescriptionError = Boolean(errors[`servicesDescription_${category.id}`]);
                return (
                  <div key={category.id} className="home-step-card">
                    <button
                      type="button"
                      className="home-btn home-btn-secondary"
                      onClick={() => setOpenCategoryId((prev) => (prev === category.id ? "" : category.id))}
                    >
                      <span>{category.label}</span>
                      <span>Selezionati: {selected.length}</span>
                    </button>
                    {isOpen ? (
                      <div className="stack" style={{ marginTop: "0.75rem" }}>
                        <div className="grid-form" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))" }}>
                          {category.services.map((service) => {
                            const checked = selected.includes(service.id);
                            return (
                              <label key={service.id} className="home-step-card" style={{ padding: "0.5rem 0.75rem" }}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleCompanyService(category.id, service.id)}
                                />
                                <span style={{ marginLeft: "0.5rem" }}>{service.label}</span>
                              </label>
                            );
                          })}
                        </div>
                        <label className={`floating-field ${description ? "has-value" : ""}`}>
                          <textarea
                            className="floating-input auth-input"
                            value={description}
                            onChange={(e) => {
                              const value = e.target.value;
                              setServiceDescriptionsByCategory((prev) => ({ ...prev, [category.id]: value }));
                              markDirty();
                            }}
                            placeholder=" "
                            rows={3}
                            maxLength={400}
                          />
                          <span className="floating-field-label">Descrizione servizi selezionati ({category.id})</span>
                        </label>
                        <p className="subtle">{description.length}/400</p>
                        {hasDescriptionError ? <p className="error">{errors[`servicesDescription_${category.id}`]}</p> : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
            {errors.serviceCategoriesCsv ? <p className="error">{errors.serviceCategoriesCsv}</p> : null}
          </>
        ) : null}

        <div className="revamp-step-actions">
          <Link className="home-btn home-btn-secondary" to={`/application/${applicationId}/step/2`}>
            {t("revamp.step3.backToStep2")}
          </Link>
          <Link className="home-btn home-btn-secondary" to={`/application/${applicationId}/step/4`}>
            {t("revamp.step3.goToStep4")}
          </Link>
          <button type="submit" className="home-btn home-btn-primary" disabled={saveState === "saving"}>
            <Save className="h-4 w-4" />
            <span>{saveState === "saving" ? t("revamp.step.common.saving") : t("revamp.step.common.saveSection")}</span>
          </button>
        </div>
      </form>
    </section>
  );
}
