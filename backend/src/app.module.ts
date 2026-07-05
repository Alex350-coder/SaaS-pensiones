import { Module } from '@nestjs/common';
import { CoreModule } from './core/core.module';

/** Bounded-context modules (src/modules/*) are added here phase by phase. */
@Module({
  imports: [CoreModule],
})
export class AppModule {}
