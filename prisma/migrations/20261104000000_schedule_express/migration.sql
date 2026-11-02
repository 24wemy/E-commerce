-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "expressFee" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isExpress" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "scheduledAt" TIMESTAMP(3),
ADD COLUMN     "scheduledEnd" TIMESTAMP(3),
ADD COLUMN     "shippedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Order_fulfillmentMethod_status_idx" ON "Order"("fulfillmentMethod", "status");

