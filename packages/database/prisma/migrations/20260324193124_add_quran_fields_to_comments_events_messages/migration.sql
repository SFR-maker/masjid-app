-- AlterTable
ALTER TABLE "announcement_comments" ADD COLUMN     "quranArabic" TEXT,
ADD COLUMN     "quranAyah" INTEGER,
ADD COLUMN     "quranEnglish" TEXT,
ADD COLUMN     "quranSurah" INTEGER,
ADD COLUMN     "quranSurahName" TEXT;

-- AlterTable
ALTER TABLE "direct_messages" ADD COLUMN     "quranArabic" TEXT,
ADD COLUMN     "quranAyah" INTEGER,
ADD COLUMN     "quranEnglish" TEXT,
ADD COLUMN     "quranSurah" INTEGER,
ADD COLUMN     "quranSurahName" TEXT;

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "quranArabic" TEXT,
ADD COLUMN     "quranAyah" INTEGER,
ADD COLUMN     "quranEnglish" TEXT,
ADD COLUMN     "quranSurah" INTEGER,
ADD COLUMN     "quranSurahName" TEXT;
