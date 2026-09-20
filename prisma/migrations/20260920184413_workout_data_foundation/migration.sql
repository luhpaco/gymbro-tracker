/*
  Warnings:

  - A unique constraint covering the columns `[userId,tag]` on the table `Workout` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `order` to the `Set` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Workout_tag_key";

-- AlterTable
ALTER TABLE "Exercise" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Set" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "isWarmup" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "order" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Workout" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "endedAt" TIMESTAMP(3),
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Set_workoutId_order_idx" ON "Set"("workoutId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "Workout_userId_tag_key" ON "Workout"("userId", "tag");
