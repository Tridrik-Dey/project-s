export type FcrRegistryType = "ALBO_A" | "ALBO_B";

export interface FcrFieldGroup {
  key: string;
  label: string;
  step: number;
  registryType: FcrRegistryType;
}

const ALBO_A: FcrFieldGroup[] = [
  // ── Step 1 ────────────────────────────────────────────────────────────────
  { key: "foto_profilo",    label: "Foto profilo",                  step: 1, registryType: "ALBO_A" },
  { key: "dati_personali",  label: "Dati anagrafici",               step: 1, registryType: "ALBO_A" },
  { key: "dati_fiscali",    label: "Dati fiscali",                  step: 1, registryType: "ALBO_A" },
  { key: "indirizzo",       label: "Indirizzo professionale",       step: 1, registryType: "ALBO_A" },
  { key: "contatti",        label: "Contatti",                      step: 1, registryType: "ALBO_A" },
  // ── Step 2 ────────────────────────────────────────────────────────────────
  { key: "tipo_prof",       label: "Tipologia professionale",       step: 2, registryType: "ALBO_A" },
  { key: "comp_secondarie", label: "Competenze secondarie",         step: 2, registryType: "ALBO_A" },
  { key: "ateco",           label: "Codice ATECO",                  step: 2, registryType: "ALBO_A" },
  // ── Step 3 ────────────────────────────────────────────────────────────────
  { key: "istruzione",      label: "Titolo di studio",              step: 3, registryType: "ALBO_A" },
  { key: "competenze",      label: "Competenze ed esperienza",      step: 3, registryType: "ALBO_A" },
  { key: "territorio",      label: "Territorio operativo",          step: 3, registryType: "ALBO_A" },
  { key: "lingue",          label: "Lingue",                        step: 3, registryType: "ALBO_A" },
  { key: "tariffe",         label: "Disponibilità e tariffe",       step: 3, registryType: "ALBO_A" },
  { key: "esperienze",      label: "Esperienze formative",          step: 3, registryType: "ALBO_A" },
  { key: "servizi_offerti", label: "Servizi offerti",               step: 3, registryType: "ALBO_A" },
  { key: "cert_specifiche", label: "Certificazioni specifiche",     step: 3, registryType: "ALBO_A" },
  // ── Step 4 ────────────────────────────────────────────────────────────────
  { key: "cap_operativa",   label: "Capacità operativa",            step: 4, registryType: "ALBO_A" },
  { key: "referenze",       label: "Referenze",                     step: 4, registryType: "ALBO_A" },
  { key: "allegati",        label: "Allegati",                      step: 4, registryType: "ALBO_A" },
  // ── Step 5 ────────────────────────────────────────────────────────────────
  { key: "dichiarazioni",   label: "Dichiarazioni",                 step: 5, registryType: "ALBO_A" },
];

const ALBO_B: FcrFieldGroup[] = [
  // ── Step 1 ────────────────────────────────────────────────────────────────
  { key: "dati_aziendali",  label: "Dati aziendali",                step: 1, registryType: "ALBO_B" },
  { key: "identificativi",  label: "Identificativi fiscali",        step: 1, registryType: "ALBO_B" },
  { key: "sede_legale",     label: "Sede legale",                   step: 1, registryType: "ALBO_B" },
  { key: "sede_operativa",  label: "Sede operativa",                step: 1, registryType: "ALBO_B" },
  { key: "contatti_inst",   label: "Contatti istituzionali",        step: 1, registryType: "ALBO_B" },
  { key: "leg_rappr",       label: "Legale rappresentante",         step: 1, registryType: "ALBO_B" },
  { key: "ref_operativo",   label: "Referente operativo",           step: 1, registryType: "ALBO_B" },
  // ── Step 2 ────────────────────────────────────────────────────────────────
  { key: "dimensione",      label: "Dimensione aziendale",          step: 2, registryType: "ALBO_B" },
  { key: "ateco_b",         label: "Codici ATECO",                  step: 2, registryType: "ALBO_B" },
  { key: "regioni_op",      label: "Regioni operative",             step: 2, registryType: "ALBO_B" },
  { key: "acc_formazione",  label: "Accreditamento formazione",     step: 2, registryType: "ALBO_B" },
  { key: "terzo_settore",   label: "Terzo settore",                 step: 2, registryType: "ALBO_B" },
  // ── Step 3 ────────────────────────────────────────────────────────────────
  { key: "servizi_cat",     label: "Categorie di servizi",          step: 3, registryType: "ALBO_B" },
  // ── Step 4 ────────────────────────────────────────────────────────────────
  { key: "certificazioni",  label: "Certificazioni",                step: 4, registryType: "ALBO_B" },
  { key: "allegati_b",      label: "Allegati aziendali",            step: 4, registryType: "ALBO_B" },
  // ── Step 5 ────────────────────────────────────────────────────────────────
  { key: "dichiarazioni_b", label: "Dichiarazioni",                 step: 5, registryType: "ALBO_B" },
];

export const FCR_FIELD_GROUPS: FcrFieldGroup[] = [...ALBO_A, ...ALBO_B];

export function getFcrGroupsForRegistry(registryType: FcrRegistryType): FcrFieldGroup[] {
  return FCR_FIELD_GROUPS.filter((g) => g.registryType === registryType);
}

export function getFcrGroup(key: string): FcrFieldGroup | undefined {
  return FCR_FIELD_GROUPS.find((g) => g.key === key);
}
