import { useEffect, useState } from "react";
import { CheckCircle2, Copy, MailCheck } from "lucide-react";
import { Link, Navigate, useParams } from "react-router-dom";
import { getRevampApplicationSummary, type RevampApplicationSummary } from "../../api/revampApplicationApi";
import { HttpError } from "../../api/http";
import { useAuth } from "../../auth/AuthContext";
import { useI18n } from "../../i18n/I18nContext";
import { saveRevampApplicationSession } from "../../utils/revampApplicationSession";

export function RevampApplicationSubmittedPage() {
  const { applicationId } = useParams();
  const { auth } = useAuth();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [summary, setSummary] = useState<RevampApplicationSummary | null>(null);

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
          resumePath: `/application/${applicationId}/submitted`
        });
      } catch (error) {
        const message = error instanceof HttpError ? error.message : t("revamp.submitted.loadErrorFallback");
        setLoadError(message);
      } finally {
        setLoading(false);
      }
    }
    void bootstrap();
  }, [applicationId, auth?.token, t]);

  async function copyProtocol() {
    if (!summary?.protocolCode) return;
    try {
      await navigator.clipboard.writeText(summary.protocolCode);
    } catch {
      // no-op
    }
  }

  if (!applicationId) return <Navigate to="/apply" replace />;
  if (!auth?.token) return <Navigate to="/login" replace />;

  if (loading) {
    return (
      <section className="stack">
        <div className="panel">
          <h2>{t("revamp.submitted.loading")}</h2>
        </div>
      </section>
    );
  }

  if (loadError || !summary) {
    return (
      <section className="stack">
        <div className="panel">
          <h2>{t("revamp.submitted.loadFailedTitle")}</h2>
          <p className="error">{loadError ?? t("revamp.submitted.loadDataUnavailable")}</p>
          <Link className="home-inline-link home-inline-link-supplier" to="/supplier">
            {t("revamp.common.backToSupplier")}
          </Link>
        </div>
      </section>
    );
  }

  if (summary.status !== "SUBMITTED") {
    return <Navigate to={`/application/${applicationId}/recap`} replace />;
  }

  return (
    <section className="stack">
      <div className="panel">
        <h2><CheckCircle2 className="h-4 w-4" /> {t("revamp.submitted.title")}</h2>
        <p className="subtle">{t("revamp.submitted.subtitle")}</p>
      </div>

      <div className="panel home-step-card">
        <div className="home-step-head">
          <span className="home-step-index">ID</span>
          <h4>{t("revamp.submitted.protocolLabel")}</h4>
        </div>
        <p><strong>{summary.protocolCode ?? t("revamp.submitted.protocolPending")}</strong></p>
        <button type="button" className="home-btn home-btn-secondary" onClick={copyProtocol} disabled={!summary.protocolCode}>
          <Copy className="h-4 w-4" />
          <span>{t("revamp.submitted.copyProtocol")}</span>
        </button>
      </div>

      <div className="panel home-step-card">
        <div className="home-step-head">
          <span className="home-step-index">MAIL</span>
          <h4>{t("revamp.submitted.emailConfirmTitle")}</h4>
        </div>
        <p>{t("revamp.submitted.emailConfirmBody")}</p>
        <span className="subtle"><MailCheck className="h-4 w-4" /> {t("revamp.submitted.statusLabel", { status: summary.status })}</span>
      </div>

      <div className="panel revamp-step-actions">
        <Link className="home-btn home-btn-primary" to="/supplier">
          {t("revamp.submitted.goToSupplier")}
        </Link>
      </div>
    </section>
  );
}
