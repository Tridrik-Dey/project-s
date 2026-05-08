import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowRight, ChevronDown, ChevronUp, CircleHelp, ClipboardCheck, Send, ShieldCheck, UserPlus, UsersRound } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { submitSupportContact } from "../../api/supportApi";
import { AppToast } from "../../components/ui/toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "../../components/ui/dialog";
import { useI18n } from "../../i18n/I18nContext";

export function HomePage() {
  const { t, language } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportName, setSupportName] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [supportTopic, setSupportTopic] = useState<"access" | "documents" | "validation" | "other">("other");
  const [supportDetailsOpen, setSupportDetailsOpen] = useState(false);
  const [supportLoading, setSupportLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);

  const canSubmitSupport = useMemo(() => {
    return supportMessage.trim().length > 0;
  }, [supportMessage]);
  const registerEntryPath = "/register";

  useEffect(() => {
    const onOpenSupportModal = () => setSupportOpen(true);
    window.addEventListener("open-support-modal", onOpenSupportModal);
    return () => window.removeEventListener("open-support-modal", onOpenSupportModal);
  }, []);

  useEffect(() => {
    if (searchParams.get("support") !== "1") return;
    setSupportOpen(true);
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  function resetSupportForm() {
    setSupportName("");
    setSupportEmail("");
    setSupportMessage("");
    setSupportTopic("other");
    setSupportDetailsOpen(false);
  }

  async function onSubmitSupport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmitSupport || supportLoading) return;
    if (supportName.trim().length === 0 || supportEmail.trim().length === 0) {
      setSupportDetailsOpen(true);
      setToast({ message: t("home.support.missingDetails"), type: "error" });
      return;
    }
    setSupportLoading(true);
    try {
      await submitSupportContact({
        name: supportName.trim(),
        email: supportEmail.trim(),
        message: `[${t(`home.support.topic.${supportTopic}`)}]\n${supportMessage.trim()}`,
        language
      });
      setToast({ message: t("home.support.success"), type: "success" });
      resetSupportForm();
      setSupportOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : t("home.support.error");
      setToast({ message, type: "error" });
    } finally {
      setSupportLoading(false);
    }
  }

  return (
    <section className="stack home-page">
      {toast ? <AppToast toast={toast} onClose={() => setToast(null)} /> : null}
      <div className="panel home-hero">
        <div className="home-hero-copy">
          <h2>{t("home.hero.title")}</h2>
          <p>{t("home.hero.subtitle")}</p>
          <div className="home-hero-actions">
            <Link className="home-btn home-btn-primary" to="/login">
              <ArrowRight className="h-4 w-4" />
              <span>{t("home.hero.login")}</span>
            </Link>
            <Link className="home-btn home-btn-secondary" to={registerEntryPath}>
              <UserPlus className="h-4 w-4" />
              <span>{t("home.hero.register")}</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="panel home-section">
        <div className="home-section-head">
          <h3>{t("home.how.title")}</h3>
        </div>
        <div className="home-steps">
          <article className="home-step-card">
            <div className="home-step-head">
              <span className="home-step-index">1</span>
              <h4>{t("home.how.step1.title")}</h4>
            </div>
            <p>{t("home.how.step1.text")}</p>
          </article>
          <article className="home-step-card">
            <div className="home-step-head">
              <span className="home-step-index">2</span>
              <h4>{t("home.how.step2.title")}</h4>
            </div>
            <p>{t("home.how.step2.text")}</p>
          </article>
          <article className="home-step-card">
            <div className="home-step-head">
              <span className="home-step-index">3</span>
              <h4>{t("home.how.step3.title")}</h4>
            </div>
            <p>{t("home.how.step3.text")}</p>
          </article>
        </div>
      </div>

      <div className="home-role-grid">
        <article className="panel home-role-card home-role-card-supplier">
          <div className="home-role-head">
            <span className="home-role-icon-badge" aria-hidden="true">
              <UsersRound className="h-4 w-4" />
            </span>
            <h3>{t("home.role.supplier.title")}</h3>
          </div>
          <p>{t("home.role.supplier.text")}</p>
          <Link className="home-inline-link home-inline-link-supplier" to={registerEntryPath}>
            <span>{t("home.role.supplier.cta")}</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </article>
        <article className="panel home-role-card home-role-card-admin">
          <div className="home-role-head">
            <span className="home-role-icon-badge" aria-hidden="true">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <h3>{t("home.role.admin.title")}</h3>
          </div>
          <p>{t("home.role.admin.text")}</p>
          <Link className="home-inline-link home-inline-link-admin" to="/login">
            <span>{t("home.role.admin.cta")}</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </article>
      </div>

      <div className="panel home-help">
        <div className="home-help-item">
          <CircleHelp className="h-4 w-4" />
          <span>{t("home.help.faq")}</span>
        </div>
        <div className="home-help-item">
          <ClipboardCheck className="h-4 w-4" />
          <span>{t("home.help.privacy")}</span>
        </div>
        <button
          type="button"
          className="home-help-item home-help-link home-help-link-btn"
          onClick={() => setSupportOpen(true)}
        >
          <ArrowRight className="h-4 w-4" />
          <span>{t("home.help.support")}</span>
        </button>
      </div>

      <Dialog
        open={supportOpen}
        onOpenChange={(nextOpen) => {
          setSupportOpen(nextOpen);
          if (!nextOpen) {
            resetSupportForm();
          }
        }}
      >
        <DialogContent
          className="home-support-modal"
          style={{
            position: "fixed",
            inset: "auto 16px 16px auto",
            left: "auto",
            top: "auto",
            right: "16px",
            bottom: "16px",
            transform: "none",
            margin: 0
          }}
        >
          <DialogHeader className="home-support-header">
            <DialogTitle className="home-support-title">{t("home.support.title")}</DialogTitle>
            <DialogDescription className="home-support-description">{t("home.support.subtitle")}</DialogDescription>
          </DialogHeader>
          <form className="home-support-form" onSubmit={onSubmitSupport}>
            <div className="home-support-body">
              <div className="home-support-topic-row" role="group" aria-label={t("home.support.topic.group")}>
                {(["access", "documents", "validation", "other"] as const).map((topic) => (
                  <button
                    key={topic}
                    type="button"
                    className={`home-support-topic-chip${supportTopic === topic ? " is-active" : ""}`}
                    onClick={() => setSupportTopic(topic)}
                  >
                    {t(`home.support.topic.${topic}`)}
                  </button>
                ))}
              </div>
              <label className="home-support-field">
                <span>{t("home.support.message")}</span>
                <textarea
                  value={supportMessage}
                  onChange={(e) => setSupportMessage(e.target.value)}
                  placeholder={t("home.support.message.placeholder")}
                  maxLength={3000}
                  rows={4}
                />
              </label>
              <button
                type="button"
                className="home-support-details-toggle"
                onClick={() => setSupportDetailsOpen((prev) => !prev)}
                aria-expanded={supportDetailsOpen}
              >
                <span>{t("home.support.details.toggle")}</span>
                {supportDetailsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {supportDetailsOpen ? (
                <div className="home-support-details-grid">
                  <label className="home-support-field">
                    <span>{t("home.support.name")}</span>
                    <input
                      value={supportName}
                      onChange={(e) => setSupportName(e.target.value)}
                      placeholder={t("home.support.name.placeholder")}
                      maxLength={120}
                    />
                  </label>
                  <label className="home-support-field">
                    <span>{t("home.support.email")}</span>
                    <input
                      type="email"
                      value={supportEmail}
                      onChange={(e) => setSupportEmail(e.target.value)}
                      placeholder={t("home.support.email.placeholder")}
                      maxLength={190}
                    />
                  </label>
                </div>
              ) : null}
            </div>
            <DialogFooter className="home-support-actions">
              <button
                type="submit"
                className="home-support-btn home-support-btn-primary home-support-send-icon-btn"
                disabled={!canSubmitSupport || supportLoading}
                aria-label={supportLoading ? t("home.support.sending") : t("home.support.send")}
                title={supportLoading ? t("home.support.sending") : t("home.support.send")}
              >
                <Send className={`h-4 w-4${supportLoading ? " is-loading" : ""}`} />
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}

