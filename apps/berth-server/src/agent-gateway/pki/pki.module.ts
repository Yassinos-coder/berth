import { Module } from '@nestjs/common';
import { CaService } from './ca.service';

@Module({
  providers: [CaService],
  exports: [CaService],
})
export class PkiModule {}
