DO $$
BEGIN
  IF to_regclass('"_prisma_migrations"') IS NOT NULL THEN
    UPDATE "_prisma_migrations"
    SET migration_name = '0' || migration_name
    WHERE migration_name ~ '^[0-9]_';
  END IF;
END $$;
