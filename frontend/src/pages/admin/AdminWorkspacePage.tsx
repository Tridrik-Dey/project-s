import { ArrowRight, ShieldCheck } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

type AdminWorkspaceSection =
  | "integrations"
  | "invites"
  | "inviteNew"
  | "evaluations"
  | "evaluationDetail"
  | "reports"
  | "usersRoles";

interface AdminWorkspacePageProps {
  section: AdminWorkspaceSection;
}

function resolveHeading(section: AdminWorkspaceSection): string {
  if (section === "integrations") return "Integrazioni pratica";
  if (section === "invites") return "Gestione inviti";
  if (section === "inviteNew") return "Nuovo invito";
  if (section === "evaluations") return "Valutazioni fornitori";
  if (section === "evaluationDetail") return "Dettaglio valutazione fornitore";
  if (section === "reports") return "Report e KPI";
  return "Utenti e ruoli amministrativi";
}

function resolveDescription(section: AdminWorkspaceSection): string {
  if (section === "integrations") return "Vista dedicata alle richieste integrazione collegate alla pratica selezionata.";
  if (section === "invites") return "Registro inviti con stato, filtri e tracciamento apertura.";
  if (section === "inviteNew") return "Creazione guidata invito con anteprima messaggio e controlli validita.";
  if (section === "evaluations") return "Lista valutazioni aggregate per fornitore con filtri e trend.";
  if (section === "evaluationDetail") return "Dettaglio storico valutazioni per il fornitore selezionato.";
  if (section === "reports") return "Cruscotto reportistica amministrativa ed esportazioni.";
  return "Gestione ruoli amministrativi con controlli di autorizzazione.";
}

export function AdminWorkspacePage({ section }: AdminWorkspacePageProps) {
  const location = useLocation();
  const heading = resolveHeading(section);
  const description = resolveDescription(section);

  return (
    <section className="stack">
      <div className="panel">
        <h2><ShieldCheck className="h-5 w-5" /> {heading}</h2>
        <p className="subtle">{description}</p>
      </div>

      <div className="panel home-step-card">
        <div className="home-step-head">
          <span className="home-step-index">AD</span>
          <h4>Sezione admin pronta per integrazione</h4>
        </div>
        <p>
          La route e attiva e collegata alla IA revamp. In questo step abbiamo
          consolidato navigazione e permessi mantenendo retro-compatibilita.
        </p>
        <p className="subtle">Percorso corrente: {location.pathname}</p>
        <Link className="home-inline-link home-inline-link-admin" to="/admin/dashboard">
          <span>Torna a dashboard admin</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}


