-- CreateTable
CREATE TABLE "CustomerProfile" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "shopifyCustomerId" TEXT,
    "sessionId" TEXT,
    "sizeProfile" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerProfile_shop_idx" ON "CustomerProfile"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerProfile_shop_shopifyCustomerId_key" ON "CustomerProfile"("shop", "shopifyCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerProfile_shop_sessionId_key" ON "CustomerProfile"("shop", "sessionId");
