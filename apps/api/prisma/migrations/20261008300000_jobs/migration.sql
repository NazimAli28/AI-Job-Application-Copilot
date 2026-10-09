-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "location" TEXT,
    "employmentType" TEXT,
    "workType" TEXT,
    "url" TEXT,
    "salary" TEXT,
    "description" TEXT NOT NULL,
    "experienceYearsMin" DOUBLE PRECISION,
    "educationRequirement" TEXT,
    "responsibilities" TEXT[],
    "requirements" JSONB NOT NULL DEFAULT '[]',
    "importedFrom" TEXT,
    "status" TEXT NOT NULL DEFAULT 'saved',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "appliedAt" TEXT,
    "applyBy" TEXT,
    "nextAction" TEXT,
    "nextActionAt" TEXT,
    "source" TEXT,
    "referral" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "tags" TEXT[],
    "interviewDates" TEXT[],
    "contacts" JSONB NOT NULL DEFAULT '[]',
    "screeningAnswers" JSONB NOT NULL DEFAULT '[]',
    "resumeId" TEXT,
    "coverLetterId" TEXT,
    "coverLetterText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobStatusHistory" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobAttachment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "storageKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Job_userId_createdAt_idx" ON "Job"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "JobStatusHistory_jobId_at_idx" ON "JobStatusHistory"("jobId", "at");

-- CreateIndex
CREATE UNIQUE INDEX "JobAttachment_storageKey_key" ON "JobAttachment"("storageKey");

-- CreateIndex
CREATE INDEX "JobAttachment_jobId_createdAt_idx" ON "JobAttachment"("jobId", "createdAt");

-- Prototype-era jobIds point at mock jobs (Phase 3 stored them as plain strings).
UPDATE "Resume" SET "jobId" = NULL WHERE "jobId" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "Resume" ADD CONSTRAINT "Resume_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobStatusHistory" ADD CONSTRAINT "JobStatusHistory_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobAttachment" ADD CONSTRAINT "JobAttachment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobAttachment" ADD CONSTRAINT "JobAttachment_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

