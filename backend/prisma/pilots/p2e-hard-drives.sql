-- Development pilot only. Apply after 20260814000000_add_dynamic_attributes.
-- It does not rewrite Product.specs; the legacy JSON remains available as fallback.
INSERT INTO "attribute_definitions" ("id", "code", "name_ar", "name_en", "data_type", "unit", "allowed_values") VALUES
  (gen_random_uuid(), 'capacity', 'السعة', 'Capacity', 'SELECT', NULL, '["1 TB","2 TB","4 TB","8 TB"]'::jsonb),
  (gen_random_uuid(), 'interface', 'واجهة التوصيل', 'Interface', 'SELECT', NULL, '["SATA 6 Gb/s","SAS 12 Gb/s","USB 3.2"]'::jsonb),
  (gen_random_uuid(), 'rotational_speed', 'سرعة الدوران', 'Rotational Speed', 'NUMBER', 'rpm', NULL),
  (gen_random_uuid(), 'cache', 'ذاكرة التخزين المؤقت', 'Cache', 'NUMBER', 'MB', NULL),
  (gen_random_uuid(), 'form_factor', 'عامل الشكل', 'Form Factor', 'SELECT', NULL, '["2.5 inch","3.5 inch"]'::jsonb)
ON CONFLICT ("code") DO UPDATE SET
  "name_ar" = EXCLUDED."name_ar", "name_en" = EXCLUDED."name_en",
  "unit" = EXCLUDED."unit", "allowed_values" = EXCLUDED."allowed_values", "is_active" = true;

DO $$
DECLARE profile_id uuid;
BEGIN
  SELECT "id" INTO profile_id FROM "attribute_profiles" WHERE "name" = 'Hard Drives' ORDER BY "created_at" LIMIT 1;
  IF profile_id IS NULL THEN
    profile_id := gen_random_uuid();
    INSERT INTO "attribute_profiles" ("id", "name", "description")
    VALUES (profile_id, 'Hard Drives', 'P2E pilot profile for HDD products.');
  END IF;

  INSERT INTO "attribute_profile_items" (
    "id", "profile_id", "attribute_definition_id", "required", "filterable",
    "comparable", "visible_on_product", "visible_in_summary", "sort_order"
  )
  SELECT gen_random_uuid(), profile_id, definition."id",
    definition."code" IN ('capacity', 'interface'),
    definition."code" IN ('capacity', 'interface', 'rotational_speed', 'form_factor'),
    true, true, definition."code" IN ('capacity', 'interface'),
    CASE definition."code"
      WHEN 'capacity' THEN 10 WHEN 'interface' THEN 20 WHEN 'rotational_speed' THEN 30
      WHEN 'cache' THEN 40 ELSE 50 END
  FROM "attribute_definitions" definition
  WHERE definition."code" IN ('capacity', 'interface', 'rotational_speed', 'cache', 'form_factor')
  ON CONFLICT ("profile_id", "attribute_definition_id") DO UPDATE SET
    "required" = EXCLUDED."required", "filterable" = EXCLUDED."filterable",
    "comparable" = EXCLUDED."comparable", "visible_on_product" = EXCLUDED."visible_on_product",
    "visible_in_summary" = EXCLUDED."visible_in_summary", "sort_order" = EXCLUDED."sort_order";

  UPDATE "categories" SET "attribute_profile_id" = profile_id WHERE "slug" = 'hdd';
END $$;

DO $$
DECLARE product_id uuid;
BEGIN
  SELECT "id" INTO product_id FROM "products" WHERE "slug" = 'seagate-barracuda-2tb';
  IF product_id IS NULL THEN RETURN; END IF;

  INSERT INTO "product_attribute_values" ("id", "product_id", "attribute_definition_id", "text_value")
  SELECT gen_random_uuid(), product_id, "id",
    CASE "code" WHEN 'capacity' THEN '2 TB' WHEN 'interface' THEN 'SATA 6 Gb/s' ELSE '3.5 inch' END
  FROM "attribute_definitions" WHERE "code" IN ('capacity', 'interface', 'form_factor')
  ON CONFLICT ("product_id", "attribute_definition_id") DO UPDATE SET
    "text_value" = EXCLUDED."text_value", "number_value" = NULL, "boolean_value" = NULL, "json_value" = NULL;

  INSERT INTO "product_attribute_values" ("id", "product_id", "attribute_definition_id", "number_value")
  SELECT gen_random_uuid(), product_id, "id",
    CASE "code" WHEN 'rotational_speed' THEN 7200 ELSE 256 END
  FROM "attribute_definitions" WHERE "code" IN ('rotational_speed', 'cache')
  ON CONFLICT ("product_id", "attribute_definition_id") DO UPDATE SET
    "text_value" = NULL, "number_value" = EXCLUDED."number_value", "boolean_value" = NULL, "json_value" = NULL;
END $$;
