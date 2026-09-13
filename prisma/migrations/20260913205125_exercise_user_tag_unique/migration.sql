/*
  Warnings:

  - A unique constraint covering the columns `[userId,tag]` on the table `Exercise` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Exercise_userId_tag_key" ON "Exercise"("userId", "tag");
