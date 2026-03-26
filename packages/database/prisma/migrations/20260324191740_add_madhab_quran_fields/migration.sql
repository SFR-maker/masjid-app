-- AlterTable
ALTER TABLE "announcements" ADD COLUMN     "quranArabic" TEXT,
ADD COLUMN     "quranAyah" INTEGER,
ADD COLUMN     "quranEnglish" TEXT,
ADD COLUMN     "quranSurah" INTEGER,
ADD COLUMN     "quranSurahName" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "madhabPreference" TEXT NOT NULL DEFAULT 'STANDARD';
