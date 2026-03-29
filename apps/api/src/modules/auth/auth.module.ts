import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import * as admin from 'firebase-admin';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { HttpsProxyAgent } = require('https-proxy-agent');

@Module({
  providers: [AuthService],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule implements OnModuleInit {
  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    if (admin.apps.length) return;

    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.config.get<string>('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n');

    if (!projectId) {
      console.warn('[Auth] FIREBASE_PROJECT_ID not set — all authenticated endpoints will return 401');
      return;
    }

    const proxyUrl = process.env.https_proxy || process.env.HTTPS_PROXY || process.env.http_proxy || process.env.HTTP_PROXY;
    const httpAgent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined;
    if (httpAgent) console.log('[Auth] Using proxy for Firebase Admin:', proxyUrl);

    try {
      if (clientEmail && privateKey && !privateKey.includes('REPLACE')) {
        admin.initializeApp({
          credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
          httpAgent,
        });
      } else {
        admin.initializeApp({ projectId, httpAgent });
      }
      console.log('[Auth] Firebase Admin initialized');
    } catch (err) {
      console.warn('[Auth] Firebase Admin init failed:', err);
    }
  }
}
