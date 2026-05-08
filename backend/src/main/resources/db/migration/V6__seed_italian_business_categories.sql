-- Expand service categories with Italian business context taxonomy.
-- Safe re-run using unique code constraint + ON CONFLICT DO NOTHING.

INSERT INTO service_categories (id, code, name, parent_id, is_active, created_at)
VALUES
  (gen_random_uuid(), 'ENERGY_SERVICES', 'Energy Services', NULL, TRUE, NOW()),
  (gen_random_uuid(), 'FOOD_BEVERAGE', 'Food & Beverage', NULL, TRUE, NOW()),
  (gen_random_uuid(), 'TEXTILE_FASHION', 'Textile & Fashion', NULL, TRUE, NOW()),
  (gen_random_uuid(), 'AUTOMOTIVE', 'Automotive', NULL, TRUE, NOW()),
  (gen_random_uuid(), 'HEALTHCARE', 'Healthcare', NULL, TRUE, NOW()),
  (gen_random_uuid(), 'CHEMICALS', 'Chemicals', NULL, TRUE, NOW()),
  (gen_random_uuid(), 'REAL_ESTATE', 'Real Estate', NULL, TRUE, NOW()),
  (gen_random_uuid(), 'HOSPITALITY', 'Hospitality & Tourism', NULL, TRUE, NOW()),
  (gen_random_uuid(), 'AGRICULTURE', 'Agriculture', NULL, TRUE, NOW()),
  (gen_random_uuid(), 'WASTE_RECYCLING', 'Waste & Recycling', NULL, TRUE, NOW()),
  (gen_random_uuid(), 'SECURITY', 'Security Services', NULL, TRUE, NOW())
ON CONFLICT (code) DO NOTHING;

INSERT INTO service_categories (id, code, name, parent_id, is_active, created_at)
VALUES
  (gen_random_uuid(), 'LOG_FREIGHT_ROAD', 'Road Freight',
      (SELECT id FROM service_categories WHERE code = 'LOGISTICS'), TRUE, NOW()),
  (gen_random_uuid(), 'LOG_FREIGHT_SEA', 'Sea Freight',
      (SELECT id FROM service_categories WHERE code = 'LOGISTICS'), TRUE, NOW()),
  (gen_random_uuid(), 'LOG_CUSTOMS', 'Customs Brokerage',
      (SELECT id FROM service_categories WHERE code = 'LOGISTICS'), TRUE, NOW()),
  (gen_random_uuid(), 'CONSULTING_TAX', 'Tax Advisory',
      (SELECT id FROM service_categories WHERE code = 'CONSULTING'), TRUE, NOW()),
  (gen_random_uuid(), 'CONSULTING_LEGAL_COMPLIANCE', 'Legal Compliance',
      (SELECT id FROM service_categories WHERE code = 'CONSULTING'), TRUE, NOW()),
  (gen_random_uuid(), 'CONSULTING_DIGITAL', 'Digital Transformation',
      (SELECT id FROM service_categories WHERE code = 'CONSULTING'), TRUE, NOW()),
  (gen_random_uuid(), 'ENERGY_SOLAR', 'Solar Installation',
      (SELECT id FROM service_categories WHERE code = 'ENERGY_SERVICES'), TRUE, NOW()),
  (gen_random_uuid(), 'ENERGY_EFFICIENCY', 'Energy Efficiency Audits',
      (SELECT id FROM service_categories WHERE code = 'ENERGY_SERVICES'), TRUE, NOW()),
  (gen_random_uuid(), 'ENERGY_MAINTENANCE', 'Electrical Maintenance',
      (SELECT id FROM service_categories WHERE code = 'ENERGY_SERVICES'), TRUE, NOW()),
  (gen_random_uuid(), 'HEALTHCARE_MEDICAL_SUPPLIES', 'Medical Supplies',
      (SELECT id FROM service_categories WHERE code = 'HEALTHCARE'), TRUE, NOW()),
  (gen_random_uuid(), 'HEALTHCARE_CLINICAL_SERVICES', 'Clinical Services',
      (SELECT id FROM service_categories WHERE code = 'HEALTHCARE'), TRUE, NOW()),
  (gen_random_uuid(), 'FOOD_PROCESSING', 'Food Processing',
      (SELECT id FROM service_categories WHERE code = 'FOOD_BEVERAGE'), TRUE, NOW()),
  (gen_random_uuid(), 'FOOD_CATERING', 'Industrial Catering',
      (SELECT id FROM service_categories WHERE code = 'FOOD_BEVERAGE'), TRUE, NOW()),
  (gen_random_uuid(), 'TEXTILE_GARMENT', 'Garment Manufacturing',
      (SELECT id FROM service_categories WHERE code = 'TEXTILE_FASHION'), TRUE, NOW()),
  (gen_random_uuid(), 'AUTOMOTIVE_COMPONENTS', 'Automotive Components',
      (SELECT id FROM service_categories WHERE code = 'AUTOMOTIVE'), TRUE, NOW()),
  (gen_random_uuid(), 'WASTE_HAZARDOUS', 'Hazardous Waste Management',
      (SELECT id FROM service_categories WHERE code = 'WASTE_RECYCLING'), TRUE, NOW()),
  (gen_random_uuid(), 'SECURITY_GUARDING', 'Guarding Services',
      (SELECT id FROM service_categories WHERE code = 'SECURITY'), TRUE, NOW())
ON CONFLICT (code) DO NOTHING;
