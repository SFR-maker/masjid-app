-- CreateTable
CREATE TABLE "taraweeh_schedules" (
    "id" TEXT NOT NULL,
    "mosqueId" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT,
    "rakaat" INTEGER,
    "imam" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "taraweeh_schedules_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "taraweeh_schedules" ADD CONSTRAINT "taraweeh_schedules_mosqueId_fkey" FOREIGN KEY ("mosqueId") REFERENCES "mosque_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
