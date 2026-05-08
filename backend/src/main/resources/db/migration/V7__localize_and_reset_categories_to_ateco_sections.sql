ALTER TABLE service_categories
    ADD COLUMN IF NOT EXISTS name_en VARCHAR(255),
    ADD COLUMN IF NOT EXISTS name_it VARCHAR(255);

UPDATE service_categories
SET name_en = COALESCE(name_en, name),
    name_it = COALESCE(name_it, name);

UPDATE service_categories
SET is_active = FALSE;

INSERT INTO service_categories (id, code, name, name_en, name_it, parent_id, is_active, created_at)
VALUES
  (gen_random_uuid(), 'A', 'Agriculture, Forestry and Fishing', 'Agriculture, Forestry and Fishing', 'Agricoltura, silvicoltura e pesca', NULL, TRUE, NOW()),
  (gen_random_uuid(), 'B', 'Mining and Quarrying', 'Mining and Quarrying', 'Estrazione di minerali', NULL, TRUE, NOW()),
  (gen_random_uuid(), 'C', 'Manufacturing', 'Manufacturing', 'Attivita manifatturiere', NULL, TRUE, NOW()),
  (gen_random_uuid(), 'D', 'Electricity, Gas, Steam', 'Electricity, Gas, Steam', 'Fornitura di energia elettrica, gas, vapore', NULL, TRUE, NOW()),
  (gen_random_uuid(), 'E', 'Water Supply, Waste Management', 'Water Supply, Waste Management', 'Fornitura di acqua, gestione rifiuti', NULL, TRUE, NOW()),
  (gen_random_uuid(), 'F', 'Construction', 'Construction', 'Costruzioni', NULL, TRUE, NOW()),
  (gen_random_uuid(), 'G', 'Wholesale and Retail Trade', 'Wholesale and Retail Trade', 'Commercio all’ingrosso e al dettaglio', NULL, TRUE, NOW()),
  (gen_random_uuid(), 'H', 'Transportation and Storage', 'Transportation and Storage', 'Trasporto e magazzinaggio', NULL, TRUE, NOW()),
  (gen_random_uuid(), 'I', 'Accommodation and Food Services', 'Accommodation and Food Services', 'Attivita dei servizi di alloggio e ristorazione', NULL, TRUE, NOW()),
  (gen_random_uuid(), 'J', 'Information and Communication', 'Information and Communication', 'Servizi di informazione e comunicazione', NULL, TRUE, NOW()),
  (gen_random_uuid(), 'K', 'Financial and Insurance Activities', 'Financial and Insurance Activities', 'Attivita finanziarie e assicurative', NULL, TRUE, NOW()),
  (gen_random_uuid(), 'L', 'Real Estate Activities', 'Real Estate Activities', 'Attivita immobiliari', NULL, TRUE, NOW()),
  (gen_random_uuid(), 'M', 'Professional, Scientific and Technical Activities', 'Professional, Scientific and Technical Activities', 'Attivita professionali, scientifiche e tecniche', NULL, TRUE, NOW()),
  (gen_random_uuid(), 'N', 'Administrative and Support Services', 'Administrative and Support Services', 'Noleggio, agenzie di viaggio, servizi di supporto', NULL, TRUE, NOW()),
  (gen_random_uuid(), 'O', 'Public Administration and Defence', 'Public Administration and Defence', 'Amministrazione pubblica e difesa', NULL, TRUE, NOW()),
  (gen_random_uuid(), 'P', 'Education', 'Education', 'Istruzione', NULL, TRUE, NOW()),
  (gen_random_uuid(), 'Q', 'Human Health and Social Work', 'Human Health and Social Work', 'Sanita e assistenza sociale', NULL, TRUE, NOW()),
  (gen_random_uuid(), 'R', 'Arts, Entertainment and Recreation', 'Arts, Entertainment and Recreation', 'Attivita artistiche, sportive e di intrattenimento', NULL, TRUE, NOW()),
  (gen_random_uuid(), 'S', 'Other Service Activities', 'Other Service Activities', 'Altre attivita di servizi', NULL, TRUE, NOW()),
  (gen_random_uuid(), 'T', 'Activities of Households as Employers', 'Activities of Households as Employers', 'Attivita di famiglie come datori di lavoro', NULL, TRUE, NOW()),
  (gen_random_uuid(), 'U', 'Activities of Extraterritorial Organizations', 'Activities of Extraterritorial Organizations', 'Organizzazioni extraterritoriali', NULL, TRUE, NOW())
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    name_en = EXCLUDED.name_en,
    name_it = EXCLUDED.name_it,
    parent_id = NULL,
    is_active = TRUE;
