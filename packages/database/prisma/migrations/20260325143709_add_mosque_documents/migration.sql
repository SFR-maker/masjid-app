-- CreateTable
CREATE TABLE "mosque_documents" (
    "id" TEXT NOT NULL,
    "mosqueId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mosque_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mosque_documents_mosqueId_idx" ON "mosque_documents"("mosqueId");

-- AddForeignKey
ALTER TABLE "mosque_documents" ADD CONSTRAINT "mosque_documents_mosqueId_fkey" FOREIGN KEY ("mosqueId") REFERENCES "mosque_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
