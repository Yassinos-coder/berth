import { Module } from '@nestjs/common';
import { ProxyHostsModule } from '../proxy-hosts/proxy-hosts.module';
import { StatusPagesModule } from '../status-pages/status-pages.module';

@Module({
  imports: [ProxyHostsModule, StatusPagesModule],
  exports: [ProxyHostsModule, StatusPagesModule],
})
export class EdgeModule {}
