-- Phase 9: server-side demo seed marker (daily reseed, seed version bumps).
ALTER TABLE "User" ADD COLUMN "demoSeededAt" TIMESTAMP(3),
ADD COLUMN "demoSeedVersion" INTEGER;
