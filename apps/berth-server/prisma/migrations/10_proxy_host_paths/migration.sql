-- Drop the old single-column unique constraint on domain.
DROP INDEX "ProxyHost_domain_key";

-- Add the path column. Existing rows get "/" (whole-domain), matching their
-- current behavior exactly.
ALTER TABLE "ProxyHost" ADD COLUMN "path" TEXT NOT NULL DEFAULT '/';

-- A domain can now be shared across multiple proxy hosts as long as their
-- paths differ.
CREATE UNIQUE INDEX "ProxyHost_domain_path_key"
ON "ProxyHost"("domain", "path");
