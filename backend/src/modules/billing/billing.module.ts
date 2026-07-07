import { Global, Module } from '@nestjs/common';
import { CoreModule } from '../../core/core.module';
import { CatalogModule } from '../catalog/catalog.module';
import { INVOICE_ISSUER } from '../pensions/application/ports/invoice-issuer.port';
import { InvoicesService } from './application/invoices.service';
import { SimulatedInvoiceIssuer } from './infrastructure/simulated-invoice-issuer';
import { ClientInvoicesController } from './presentation/client-invoices.controller';
import { RestaurantInvoicesController } from './presentation/restaurant-invoices.controller';

/**
 * Billing (simulated invoicing) bounded context — depends on Pensions and
 * Catalog, never the reverse. It implements Pensions' outbound INVOICE_ISSUER
 * port; marking the module @Global lets the payment flow inject that port
 * without Pensions importing Billing, so the dependency arrow stays correct.
 * Swapping SimulatedInvoiceIssuer for a real emitter is the only change needed
 * to go live.
 */
@Global()
@Module({
  imports: [CoreModule, CatalogModule],
  controllers: [RestaurantInvoicesController, ClientInvoicesController],
  providers: [
    InvoicesService,
    SimulatedInvoiceIssuer,
    { provide: INVOICE_ISSUER, useExisting: SimulatedInvoiceIssuer },
  ],
  exports: [INVOICE_ISSUER],
})
export class BillingModule {}
