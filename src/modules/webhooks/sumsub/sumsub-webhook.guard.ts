import {
  CanActivate,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  RawBodyRequest,
} from '@nestjs/common';
import axios from 'axios';
import { createHmac } from 'crypto';
import { Observable } from 'rxjs';
import { SumsubKycServiceAxiosHelper } from '../../../adapters/kyc/sumsub/sumsub.axios';
import { SumsubConfig, SumsubConfigProvider } from '../../../config/sumsub.config';

@Injectable()
export class SumsubWebhookAuthGuard implements CanActivate {
  private readonly sumsubConfig: SumsubConfig;
  private readonly sumsubAxios: SumsubKycServiceAxiosHelper;
  constructor() {
    this.sumsubConfig = new SumsubConfigProvider().getConfig();
    this.sumsubAxios = new SumsubKycServiceAxiosHelper(axios, this.sumsubConfig);
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    return this.validateRequest(request);
  }

  async validateRequest(request: Request): Promise<boolean> {
    const isValid = await this.verifyWebhookSender(request);
    return isValid;
  }

  private async verifyWebhookSender(req: RawBodyRequest<Request>): Promise<boolean> {
    const xPayloadDigestAlgorithm = req.headers['x-payload-digest-alg'];
    const xPayloadDigest = req.headers['x-payload-digest'];

    if (!xPayloadDigestAlgorithm) {
      throw new InternalServerErrorException('Missing x-payload-digest-alg header');
    }

    if (!xPayloadDigest) {
      throw new InternalServerErrorException('Missing x-payload-digest header');
    }

    const algo: string | undefined = {
      HMAC_SHA1_HEX: 'sha1',
      HMAC_SHA256_HEX: 'sha256',
      HMAC_SHA512_HEX: 'sha512',
    }[xPayloadDigestAlgorithm];

    if (!algo) {
      throw new InternalServerErrorException(`Unsupported algorithm: ${xPayloadDigestAlgorithm}`);
    }

    if (!req.rawBody) {
      throw new InternalServerErrorException('Request raw body is missing');
    }

    if (!this.sumsubConfig.webhook_secret_key) {
      throw new InternalServerErrorException('Sumsub webhook secret key is not configured');
    }

    const calculatedDigest = createHmac(algo, this.sumsubConfig.webhook_secret_key).update(req.rawBody).digest('hex');

    if (calculatedDigest !== xPayloadDigest) {
      throw new InternalServerErrorException('Webhook signature verification failed');
    }

    return true;
  }
}
