-- AlterTable
ALTER TABLE "group_chats" ADD COLUMN     "inviteToken" TEXT;

-- AlterTable
ALTER TABLE "mosque_profiles" ADD COLUMN     "amenities" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "birthdate" TIMESTAMP(3),
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "isOpenToVolunteer" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "mosque_programs" (
    "id" TEXT NOT NULL,
    "mosqueId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "schedule" TEXT,
    "ageGroup" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mosque_programs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mosque_programs_mosqueId_idx" ON "mosque_programs"("mosqueId");

-- CreateIndex
CREATE UNIQUE INDEX "group_chats_inviteToken_key" ON "group_chats"("inviteToken");

-- AddForeignKey
ALTER TABLE "mosque_programs" ADD CONSTRAINT "mosque_programs_mosqueId_fkey" FOREIGN KEY ("mosqueId") REFERENCES "mosque_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
