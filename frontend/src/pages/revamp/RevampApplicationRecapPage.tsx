import { useMemo, useState, useEffect } from "react";
import { CheckCircle2, Edit3, Send } from "lucide-react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import {
  getRevampApplicationSections,
  getRevampApplicationSummary,
  submitRevampApplication,
  type RevampApplicationSummary,
  type RevampSectionSnapshot
} from "../../api/revampApplicationApi";
import { HttpError } from "../../api/http";
import { useAuth } from "../../auth/AuthContext";
import { useI18n } from "../../i18n/I18nContext";
import { saveRevampApplicationSession } from "../../utils/revampApplicationSession";
import { areRequiredSectionsComplete, resolveSection3Key, resolveStepGuardRedirect } from "./revampFlow";

type SectionRow = {
  key: string;
  label: string;
  route: string;
  completed: boolean;
};

export function RevampApplicationRecapPage() {
  const { applicationId } = useParams();
  const { auth } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [summary, setSummary] = useState<RevampApplicationSummary | null>(null);
  const [sections, setSections] = useState<RevampSectionSnapshot[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [guardRedirect, setGuardRedirect] = useState<string | null>(null);

  useEffect(() => {
    async function bootstrap() {
      if (!applicationId || !auth?.token) return;
      setLoading(true);
      setLoadError(null);
      try {
        const [appSummary, appSections] = await Promise.all([
          getRevampApplicationSummary(applicationId, auth.token),
          getRevampApplicationSections(applicationId, auth.token)
        ]);
        setSummary(appSummary);
        setSections(appSections);
        const redirect = resolveStepGuardRedirect(applicationId, appSummary.registryType, appSections, "recap");
        setGuardRedirect(redirect);
        saveRevampApplicationSession({
          applicationId,
          status: appSummary.status,
          protocolCode: appSummary.protocolCode,
          updatedAt: appSummary.updatedAt,
          resumePath: `/application/${applicationId}/recap`
        });
      } catch (error) {
        const message = error instanceof HttpError ? error.message : t("revamp.recap.loadErrorFallback");
        setLoadError(message);
      } finally {
        setLoading(false);
      }
    }
    void bootstrap();
  }, [applicationId, auth?.token, t]);

  const rows = useMemo<SectionRow[]>(() => {
    if (!applicationId || !summary) return [];
    const section3Key = resolveSection3Key(summary.registryType, sections);
    const findCompleted = (key: string) => Boolean(sections.find((section) => section.sectionKey === key)?.completed);
    return [
      { key: "S1", label: t("revamp.recap.section.s1"), route: `/application/${applicationId}/step/1`, completed: findCompleted("S1") },
      { key: "S2", label: t("revamp.recap.section.s2"), route: `/application/${applicationId}/step/2`, completed: findCompleted("S2") },
      {
        key: section3Key,
        label: section3Key === "S3A" ? t("revamp.recap.section.s3a") : section3Key === "S3B" ? t("revamp.recap.section.s3b") : t("revamp.recap.section.s3"),
        route: `/application/${applicationId}/step/3`,
        completed: findCompleted(section3Key)
      },
      { key: "S4", label: t("revamp.recap.section.s4"), route: `/application/${applicationId}/step/4`, completed: findCompleted("S4") },
      { key: "S5", label: t("revamp.recap.section.s5"), route: `/application/${applicationId}/step/5`, completed: findCompleted("S5") }
    ];
  }, [applicationId, summary, sections, t]);

  const canSubmit = summary ? areRequiredSectionsComplete(summary.registryType, sections) : false;

  async function onSubmit() {
    if (!applicationId || !auth?.token || !canSubmit || submitting) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const submitted = await submitRevampApplication(applicationId, auth.token);
      saveRevampApplicationSession({
        applicationId,
        status: submitted.status,
        protocolCode: submitted.protocolCode,
        updatedAt: submitted.updatedAt,
        resumePath: `/application/${applicationId}/submitted`
      });
      navigate(`/application/${applicationId}/submitted`);
    } catch (error) {
      const message = error instanceof HttpError ? error.message : t("revamp.recap.submitErrorFallback");
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!applicationId) return <Navigate to="/apply" replace />;
  if (!auth?.token) return <Navigate to="/login" replace />;

  if (loading) {
    return (
      <section className="stack">
        <div className="panel">
          <h2>{t("revamp.recap.loading")}</h2>
        </div>
      </section>
    );
  }

  if (loadError || !summary) {
    return (
      <section className="stack">
        <div className="panel">
          <h2>{t("revamp.recap.loadFailedTitle")}</h2>
          <p className="error">{loadError ?? t("revamp.common.applicationNotFound")}</p>
          <Link className="home-inline-link home-inline-link-supplier" to="/supplier">
            {t("revamp.common.backToSupplier")}
          </Link>
        </div>
      </section>
    );
  }

  if (summary.status === "SUBMITTED") {
    return <Navigate to={`/application/${applicationId}/submitted`} replace />;
  }

  if (guardRedirect && guardRedirect !== `/application/${applicationId}/recap`) {
    return <Navigate to={guardRedirect} replace />;
  }

  return (
    <section className="stack">
      <div className="panel revamp-step-header">
        <h2>{t("revamp.recap.headerTitle")}</h2>
        <p className="subtle">
          {t("revamp.recap.headerSubtitle", { id: applicationId })}
        </p>
      </div>

      <div className="panel stack">
        {rows.map((row) => (
          <div key={row.key} className="home-step-card">
            <div className="home-step-head">
              <span className="home-step-index">{row.key}</span>
              <h4>{row.label}</h4>
            </div>
            <p className={row.completed ? "subtle" : "error"}>
              {row.completed ? t("revamp.recap.status.complete") : t("revamp.recap.status.pending")}
            </p>
            <Link className="home-inline-link home-inline-link-supplier" to={row.route}>
              <Edit3 className="h-4 w-4" />
              <span>{t("revamp.recap.edit")}</span>
            </Link>
          </div>
        ))}
      </div>

      <div className="panel revamp-step-actions">
        <button
          type="button"
          className="home-btn home-btn-primary"
          disabled={!canSubmit || submitting}
          onClick={onSubmit}
          title={!canSubmit ? t("revamp.recap.submitDisabledTitle") : t("revamp.recap.submit")}
        >
          {submitting ? <Send className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          <span>{submitting ? t("revamp.recap.submitInProgress") : t("revamp.recap.submit")}</span>
        </button>
        <Link className="home-btn home-btn-secondary" to={`/application/${applicationId}/step/5`}>
          {t("revamp.recap.backToStep5")}
        </Link>
      </div>

      {submitError ? <p className="error">{submitError}</p> : null}
    </section>
  );
}
