-- CreateEnum
CREATE TYPE "MosqueServiceType" AS ENUM ('QURAN_CLASSES', 'WOMENS_HALAQA', 'ISLAMIC_SCHOOL', 'SPECIAL_NEEDS', 'MARRIAGE_SERVICES', 'JANAZAH_SERVICES', 'FACILITY_RENTAL', 'YOUTH_PROGRAMS', 'OTHER');

-- AlterTable
ALTER TABLE "mosque_profiles" ADD COLUMN     "capacityMen" INTEGER,
ADD COLUMN     "capacityWomen" INTEGER,
ADD COLUMN     "directions" TEXT,
ADD COLUMN     "mainImageUrl" TEXT,
ADD COLUMN     "parkingInfo" TEXT;

-- AlterTable
ALTER TABLE "user_follows" ADD COLUMN     "isFavorite" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "mosque_services" (
    "id" TEXT NOT NULL,
    "mosqueId" TEXT NOT NULL,
    "type" "MosqueServiceType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "schedule" TEXT,
    "contact" TEXT,
    "registration" TEXT,
    "notes" TEXT,
    "capacity" INTEGER,
    "pricing" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mosque_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "direct_messages" (
    "id" TEXT NOT NULL,
    "mosqueId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "replyBody" TEXT,
    "repliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "direct_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "direct_messages_mosqueId_createdAt_idx" ON "direct_messages"("mosqueId", "createdAt");

-- AddForeignKey
ALTER TABLE "mosque_services" ADD CONSTRAINT "mosque_services_mosqueId_fkey" FOREIGN KEY ("mosqueId") REFERENCES "mosque_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_mosqueId_fkey" FOREIGN KEY ("mosqueId") REFERENCES "mosque_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
