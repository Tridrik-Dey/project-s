import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import {
  createRevampApplicationDraft,
  getMyLatestRevampApplication,
  type RevampApplicationSummary,
  type RevampRegistryType
} from "../../api/revampApplicationApi";
import { useAuth } from "../../auth/AuthContext";
import { saveRevampApplicationSession } from "../../utils/revampApplicationSession";

type BridgeTarget = "step" | "recap";

interface RevampApplicationRouteBridgeProps {
  target: BridgeTarget;
}

function parseRegistryType(value?: string): RevampRegistryType | null {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "albo-a" || normalized === "albo_a") return "ALBO_A";
  if (normalized === "albo-b" || normalized === "albo_b") return "ALBO_B";
  return null;
}

function normalizeStep(value?: string): "1" | "2" | "3" | "4" | "5" {
  if (value === "2" || value === "3" || value === "4" || value === "5") return value;
  return "1";
}

function saveSession(application: RevampApplicationSummary, resumePath: string): void {
  saveRevampApplicationSession({
    applicationId: application.id,
    status: application.status,
    protocolCode: application.protocolCode,
    updatedAt: application.updatedAt,
    resumePath
  });
}

export function RevampApplicationRouteBridge({ target }: RevampApplicationRouteBridgeProps) {
  const { registryType, stepNumber } = useParams();
  const { auth } = useAuth();
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const parsedRegistryType = parseRegistryType(registryType);

  useEffect(() => {
    if (!auth?.token || !parsedRegistryType) return;
    const token = auth.token;
    const registryTypeForDraft = parsedRegistryType;
    let cancelled = false;

    async function resolveApplication() {
      try {
        const latest = await getMyLatestRevampApplication(token);
        const application = latest?.registryType === registryTypeForDraft
          ? latest
          : await createRevampApplicationDraft(
              {
                registryType: registryTypeForDraft,
                sourceChannel: "PUBLIC"
              },
              token
            );
        const destination = target === "recap"
          ? `/application/${application.id}/recap`
          : `/application/${application.id}/step/${normalizeStep(stepNumber)}`;
        saveSession(application, destination);
        if (!cancelled) setRedirectTo(destination);
      } catch {
        if (!cancelled) setError("Impossibile aprire la candidatura revamp.");
      }
    }

    void resolveApplication();
    return () => {
      cancelled = true;
    };
  }, [auth?.token, parsedRegistryType, stepNumber, target]);

  if (!parsedRegistryType) return <Navigate to="/apply" replace />;
  if (redirectTo) return <Navigate to={redirectTo} replace />;

  return (
    <section className="stack">
      <div className="panel">
        <h2>Preparazione candidatura...</h2>
        <p className={error ? "error" : "subtle"}>
          {error ?? "Stiamo collegando il percorso fornitore al wizard revamp."}
        </p>
      </div>
    </section>
  );
}
