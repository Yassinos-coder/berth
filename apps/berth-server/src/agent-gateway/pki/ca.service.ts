import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomBytes } from 'node:crypto';
import * as forge from 'node-forge';
import { URL } from 'node:url';
import { SecretCipher } from '../../common/crypto/secret-cipher.service';

interface CaMaterial {
  cert: forge.pki.Certificate;
  key: forge.pki.PrivateKey;
}

type AltName = { type: number; value?: string; ip?: string };

export interface SignedCert {
  certPem: string;
  serial: string;
}

@Injectable()
export class CaService implements OnModuleInit {
  private readonly logger = new Logger(CaService.name);
  private ca!: CaMaterial;
  private serverCertPem!: string;
  private serverKeyPem!: string;

  constructor(
    private readonly config: ConfigService,
    private readonly cipher: SecretCipher,
  ) {}

  onModuleInit(): void {
    this.ca = this.loadOrCreateCa();
    this.issueServerCert();
    this.logger.log(`panel CA ready — fingerprint ${this.caFingerprint()}`);
  }

  tlsOptions(): { cert: string; key: string; ca: string } {
    return {
      cert: this.serverCertPem,
      key: this.serverKeyPem,
      ca: forge.pki.certificateToPem(this.ca.cert),
    };
  }

  caCertPem(): string {
    return forge.pki.certificateToPem(this.ca.cert);
  }

  caFingerprint(): string {
    const der = forge.asn1
      .toDer(forge.pki.certificateToAsn1(this.ca.cert))
      .getBytes();
    const md = forge.md.sha256.create();
    md.update(der);
    return md.digest().toHex();
  }

  signCsr(csrPem: string, commonName: string): SignedCert {
    const csr = forge.pki.certificationRequestFromPem(csrPem);
    if (!csr.verify()) {
      throw new Error('CSR signature is invalid');
    }

    const cert = forge.pki.createCertificate();
    const serial = randomBytes(16).toString('hex');
    cert.serialNumber = `00${serial}`;
    cert.publicKey = csr.publicKey as forge.pki.PublicKey;
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(
      cert.validity.notBefore.getFullYear() + 5,
    );
    cert.setSubject([{ name: 'commonName', value: commonName }]);
    cert.setIssuer(this.ca.cert.subject.attributes);
    cert.setExtensions([
      { name: 'basicConstraints', cA: false },
      { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
      { name: 'extKeyUsage', clientAuth: true },
    ]);
    cert.sign(this.ca.key as forge.pki.rsa.PrivateKey, forge.md.sha256.create());

    return { certPem: forge.pki.certificateToPem(cert), serial: cert.serialNumber };
  }

  private loadOrCreateCa(): CaMaterial {
    const certPath = this.config.get<string>('caCertPath')!;
    const keyPath = this.config.get<string>('caKeyPath')!;

    if (existsSync(certPath) && existsSync(keyPath)) {
      const cert = forge.pki.certificateFromPem(readFileSync(certPath, 'utf8'));
      const keyPem = this.cipher.decrypt(readFileSync(keyPath, 'utf8'));
      const key = forge.pki.privateKeyFromPem(keyPem);
      return { cert, key };
    }

    this.logger.log('no CA found — generating a new self-signed CA');
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = `00${randomBytes(16).toString('hex')}`;
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 10);
    const attrs = [{ name: 'commonName', value: 'Berth Panel CA' }];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.setExtensions([
      { name: 'basicConstraints', cA: true, critical: true },
      { name: 'keyUsage', keyCertSign: true, cRLSign: true, critical: true },
    ]);
    cert.sign(keys.privateKey, forge.md.sha256.create());

    mkdirSync(dirname(certPath), { recursive: true });
    mkdirSync(dirname(keyPath), { recursive: true });
    writeFileSync(certPath, forge.pki.certificateToPem(cert), { mode: 0o644 });
    writeFileSync(
      keyPath,
      this.cipher.encrypt(forge.pki.privateKeyToPem(keys.privateKey)),
      { mode: 0o600 },
    );

    return { cert, key: keys.privateKey };
  }

  private issueServerCert(): void {
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = `00${randomBytes(16).toString('hex')}`;
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 5);
    cert.setSubject([{ name: 'commonName', value: 'berth-panel' }]);
    cert.setIssuer(this.ca.cert.subject.attributes);
    cert.setExtensions([
      { name: 'basicConstraints', cA: false },
      { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
      { name: 'extKeyUsage', serverAuth: true },
      { name: 'subjectAltName', altNames: this.serverAltNames() },
    ]);
    cert.sign(this.ca.key as forge.pki.rsa.PrivateKey, forge.md.sha256.create());

    this.serverCertPem = forge.pki.certificateToPem(cert);
    this.serverKeyPem = forge.pki.privateKeyToPem(keys.privateKey);
  }

  private serverAltNames(): AltName[] {
    const altNames: AltName[] = [
      { type: 2, value: 'localhost' },
      { type: 7, ip: '127.0.0.1' },
    ];
    const publicUrl = this.config.get<string>('publicPanelUrl') ?? '';
    const host = this.extractHost(publicUrl);
    if (host && host !== 'localhost') {
      const isIp = /^\d+\.\d+\.\d+\.\d+$/.test(host);
      altNames.push(isIp ? { type: 7, ip: host } : { type: 2, value: host });
    }
    return altNames;
  }

  private extractHost(url: string): string | null {
    if (!url) return null;
    try {
      return new URL(url).hostname;
    } catch {
      return null;
    }
  }
}
