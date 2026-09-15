/*
  Warnings:

  - A unique constraint covering the columns `[userId,canonicalName]` on the table `Exercise` will be added. If there are existing duplicate values, this will fail.
  - Made the column `canonicalName` on table `Exercise` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "Exercise_name_key";

-- DropIndex
DROP INDEX "Exercise_userId_tag_key";

-- AlterTable
ALTER TABLE "Exercise" ALTER COLUMN "canonicalName" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Exercise_userId_canonicalName_key" ON "Exercise"("userId", "canonicalName");
