-- CreateTable
CREATE TABLE "client_product_prices" (
    "id" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "clientId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "client_product_prices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "client_product_prices_clientId_productId_key" ON "client_product_prices"("clientId", "productId");

-- AddForeignKey
ALTER TABLE "client_product_prices" ADD CONSTRAINT "client_product_prices_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_product_prices" ADD CONSTRAINT "client_product_prices_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
