import { Global, Module } from '@nestjs/common';
import { SecretCipher } from './secret-cipher.service';

@Global()
@Module({
  providers: [SecretCipher],
  exports: [SecretCipher],
})
export class CryptoModule {}
