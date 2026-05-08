import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { getInviteByToken } from "../../api/inviteApi";
import { HttpError } from "../../api/http";
import { saveRevampOnboardingContext } from "../../utils/revampOnboarding";

const ALLOWED_INVITE_STATUSES = new Set(["CREATED", "SENT", "OPENED", "RENEWED"]);

export function RevampInviteEntryPage() {
  const navigate = useNavigate();
  const { token } = useParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token?.trim()) {
      setLoading(false);
      return;
    }

    let mounted = true;
    void (async () => {
      try {
        const invite = await getInviteByToken(token.trim());
        if (!mounted) return;
        if (!ALLOWED_INVITE_STATUSES.has(invite.status)) {
          setError("Questo invito non e piu utilizzabile.");
          setLoading(false);
          return;
        }
        saveRevampOnboardingContext({
          registryType: invite.registryType,
          sourceChannel: "INVITE",
          inviteToken: token.trim(),
          inviteId: invite.id,
          invitedName: invite.invitedName,
          invitedEmail: invite.invitedEmail
        });

        const registerParams = new URLSearchParams({
          registryType: invite.registryType,
          sourceChannel: "INVITE",
          inviteToken: token.trim(),
          inviteId: invite.id,
          invitedEmail: invite.invitedEmail
        });
        if (invite.invitedName?.trim()) {
          registerParams.set("invitedName", invite.invitedName.trim());
        }
        const registerUrl = `/register?${registerParams.toString()}`;
        navigate(registerUrl, { replace: true });
      } catch (e) {
        if (!mounted) return;
        if (e instanceof HttpError) {
          setError(e.message || "Invito non valido o scaduto.");
        } else {
          setError("Impossibile verificare l'invito.");
        }
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [navigate, token]);

  if (!token?.trim()) {
    return <Navigate to="/apply" replace />;
  }

  return (
    <section className="panel">
      <h2>Verifica invito</h2>
      {loading ? <p className="subtle">Controllo token invito in corso...</p> : null}
      {error ? (
        <>
          <p className="error">{error}</p>
          <p className="subtle">
            <Link to="/apply">Vai alla pagina di iscrizione</Link>
          </p>
        </>
      ) : null}
    </section>
  );
}
