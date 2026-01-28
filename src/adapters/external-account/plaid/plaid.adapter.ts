import { Injectable, InternalServerErrorException, Logger, NotImplementedException } from '@nestjs/common';
import { ServiceUnavailableException } from '../../../exceptions/service_unavailable_exception';
import { AxiosError } from 'axios';
import { randomBytes } from 'crypto';
import * as JWT from 'jose';
import { sha256 } from 'js-sha256';
import { jwtDecode } from 'jwt-decode';
import * as compare from 'secure-compare';
import { RedisService } from '../../../services/redis/redis.service';
import { PlaidConnector } from '../../link-bank-account/plaid/plaid.connector';
import {
  DecisionReportRequest,
  DecisionReportResponse,
  EvaluationResult,
  EvaluationWarning,
  ExecutePaymentRequest,
  ExecutePaymentResponse,
  FundingQuoteRequest,
  FundingQuoteResponse,
  IExternalAccountAdapter,
  RefreshAuthDataRequest,
  RefreshAuthDataResponse,
  ReturnReportRequest,
  ReturnReportResponse,
  RiskScore,
  RiskSignalRequest,
  RiskSignalResponse,
  RuleDetails,
  Ruleset,
  SignalScores,
} from '../external-account.adapter.interface';

@Injectable()
export class PlaidExternalAccountAdapter extends PlaidConnector implements IExternalAccountAdapter {
  private readonly logger = new Logger(PlaidExternalAccountAdapter.name);

  constructor(private readonly redisService: RedisService) {
    super();
  }

  async evaluateRiskSignal(request: RiskSignalRequest): Promise<RiskSignalResponse> {
    this.logger.debug(`Evaluating risk signal for account ${request.accountRef}, amount: ${request.amount}`);
    const plaidConfig = this.configProvider.getConfig();

    const clientTransactionId = this.generateTransactionId();

    // Log the parameters being sent to Plaid (without sensitive data)
    this.logger.debug(`Plaid Signal API request params: {
      client_id: ${plaidConfig.clientId},
      account_id: ${request.accountRef},
      client_transaction_id: ${clientTransactionId},
      amount: ${request.amount},
      currency: ${request.currency},
      ruleset_key: ${plaidConfig.signalRulesetKey}
    }`);

    try {
      // Call Plaid Signal API to evaluate risk
      const response = await this.signalEvaluate({
        client_id: plaidConfig.clientId,
        secret: plaidConfig.secret,
        access_token: request.token,
        account_id: request.accountRef,
        client_transaction_id: clientTransactionId,
        amount: request.amount,
        ruleset_key: plaidConfig.signalRulesetKey,
      });

      const signalData = response.data;

      this.logger.debug(`Plaid Signal API response: ${JSON.stringify(signalData)}`);

      // Validate that we received the required data
      if (!signalData.request_id) {
        this.logger.error('Missing request_id from Plaid Signal API response');
        throw new InternalServerErrorException('Invalid response from Plaid API: missing request_id');
      }

      if (!signalData.ruleset?.result) {
        this.logger.error('Missing ruleset result from Plaid Signal API response');
        throw new InternalServerErrorException('Invalid response from Plaid API: missing ruleset result');
      }

      // Return the Plaid response structure, mapping to camelCase
      const result: RiskSignalResponse = {
        requestRef: signalData.request_id,
        ruleset: this.buildRulesetDetails(signalData.ruleset), // We've already validated it exists
        scores: this.buildRiskScores(signalData.scores),
        warnings: this.mapWarnings(signalData.warnings),
      };

      this.logger.log(
        `Risk signal evaluation completed: ${signalData.ruleset.result} (ruleset: ${signalData.ruleset.ruleset_key})`,
      );
      return result;
    } catch (err) {
      const e = err as AxiosError;
      this.logger.error('Plaid Signal evaluation failed', e.response?.data ?? e.message);
      throw new ServiceUnavailableException();
    }
  }

  private generateTransactionId(): string {
    return `txn_${Date.now()}_${randomBytes(6).toString('hex')}`;
  }

  private buildRulesetDetails(rulesetData: any): Ruleset {
    return {
      result: rulesetData.result as EvaluationResult,
      rulesetKey: rulesetData.ruleset_key,
      triggeredRuleDetails: this.mapTriggeredRuleDetails(rulesetData.triggered_rule_details),
    };
  }

  private mapTriggeredRuleDetails(triggeredRuleData: any): RuleDetails | undefined {
    if (!triggeredRuleData) {
      return undefined;
    }

    return {
      note: triggeredRuleData.internal_note,
      actionKey: triggeredRuleData.custom_action_key,
    };
  }

  private buildRiskScores(scoresData?: any): SignalScores {
    return {
      bankInitiatedReturnRisk: scoresData?.bank_initiated_return_risk
        ? this.buildRiskScore(scoresData.bank_initiated_return_risk)
        : undefined,
      customerInitiatedReturnRisk: scoresData?.customer_initiated_return_risk
        ? this.buildRiskScore(scoresData.customer_initiated_return_risk)
        : undefined,
    };
  }

  private buildRiskScore(scoreData: any): RiskScore {
    return {
      riskTier: scoreData.risk_tier,
      score: scoreData.score,
    };
  }

  private mapWarnings(warningsData: any[]): EvaluationWarning[] {
    if (!warningsData) {
      return [];
    }

    return warningsData.map((warning) => ({
      type: warning.warning_type || '',
      code: warning.warning_code || '',
      message: warning.warning_message || '',
    }));
  }

  async reportDecision(request: DecisionReportRequest): Promise<DecisionReportResponse> {
    this.logger.debug(`Reporting decision for transaction ${request.clientTransactionRef}`);
    const plaidConfig = this.configProvider.getConfig();

    try {
      const response = await this.signalDecisionReport({
        client_id: plaidConfig.clientId,
        secret: plaidConfig.secret,
        client_transaction_id: request.clientTransactionRef,
        initiated: request.initiated,
        days_funds_on_hold: request.daysFundsOnHold,
        amount_instantly_available: request.amountInstantlyAvailable,
      });

      this.logger.log(`Decision reported successfully for transaction ${request.clientTransactionRef}`);
      return {
        requestRef: response.data.request_id,
      };
    } catch (err) {
      const e = err as AxiosError;
      this.logger.error('Plaid decision reporting failed', e.response?.data ?? e.message);
      throw new InternalServerErrorException(
        `Decision reporting failed: ${JSON.stringify(e.response?.data ?? e.message)}`,
      );
    }
  }

  async reportReturn(request: ReturnReportRequest): Promise<ReturnReportResponse> {
    this.logger.debug(`Reporting return for transaction ${request.clientTransactionRef}`);
    const plaidConfig = this.configProvider.getConfig();

    try {
      const response = await this.signalReturnReport({
        client_id: plaidConfig.clientId,
        secret: plaidConfig.secret,
        client_transaction_id: request.clientTransactionRef,
        return_code: request.returnCode,
        returned_at: request.returnedAt,
      });

      this.logger.log(
        `Return reported successfully for transaction ${request.clientTransactionRef}: ${request.returnCode}`,
      );
      return {
        requestRef: response.data.request_id,
      };
    } catch (err) {
      const e = err as AxiosError;
      this.logger.error('Plaid return reporting failed', e.response?.data ?? e.message);
      throw new InternalServerErrorException(
        `Return reporting failed: ${JSON.stringify(e.response?.data ?? e.message)}`,
      );
    }
  }

  async requestQuote(request: FundingQuoteRequest): Promise<FundingQuoteResponse> {
    this.logger.debug(`requestQuote not supported by Plaid: ${JSON.stringify(request)}`);
    throw new NotImplementedException('Request Funding Quote is not supported by Plaid adapter');
  }

  async executePayment(request: ExecutePaymentRequest): Promise<ExecutePaymentResponse> {
    this.logger.debug(`executePayment not supported by Plaid: ${JSON.stringify(request)}`);
    throw new NotImplementedException('Execute payment is not supported by Plaid adapter');
  }

  async verifySignature(headers: Record<string, any>, body: any): Promise<boolean> {
    try {
      const signedJwt = headers['plaid-verification'];
      if (!signedJwt) {
        this.logger.warn('Missing plaid-verification header');
        return false;
      }

      // Decode JWT header and validate algorithm
      const decodedTokenHeader = jwtDecode(signedJwt, { header: true });
      if (decodedTokenHeader.alg !== 'ES256') {
        this.logger.error(`Invalid JWT algorithm: ${decodedTokenHeader.alg}. Expected ES256`);
        return false;
      }

      const currentKeyID = decodedTokenHeader.kid;
      if (!currentKeyID) {
        this.logger.error('Missing kid in JWT header');
        return false;
      }

      // Get verification key (with Redis caching)
      const verificationKey = await this.getCachedVerificationKey(currentKeyID);

      // Validate JWT signature and timestamp
      const keyLike = await JWT.importJWK(verificationKey);
      await JWT.jwtVerify(signedJwt, keyLike, {
        maxTokenAge: '5 min',
      });

      // Validate request body hash
      const decodedToken = jwtDecode(signedJwt);
      const bodyString = Buffer.isBuffer(body) ? body.toString('utf8') : JSON.stringify(body);
      const bodyHash = sha256(bodyString);
      const claimedBodyHash = (decodedToken as any).request_body_sha256;

      const isValid = compare(bodyHash, claimedBodyHash);
      if (!isValid) {
        this.logger.error('Request body hash validation failed');
      }

      return isValid;
    } catch (error) {
      this.logger.error('Webhook signature verification failed:', error);
      return false;
    }
  }

  private async getCachedVerificationKey(keyId: string): Promise<any> {
    const cacheKey = `plaid:webhook:key:${keyId}`;

    try {
      // Try to get from Redis cache first
      const cachedKey = await this.redisService.get(cacheKey);
      if (cachedKey) {
        this.logger.debug(`Using cached verification key for kid: ${keyId}`);
        return JSON.parse(cachedKey);
      }

      // Fetch new key from Plaid
      this.logger.debug(`Fetching new verification key for kid: ${keyId}`);
      const response = await this.getWebhookVerificationKey(keyId);
      const key = response.key;

      // Cache in Redis for 1 hour
      await this.redisService.set(cacheKey, JSON.stringify(key), 3600); // 1 hour TTL

      return key;
    } catch (error) {
      this.logger.error(`Failed to get verification key for kid ${keyId}:`, error);
      throw error;
    }
  }

  async getWebhookVerificationKey(keyId: string): Promise<any> {
    this.logger.log(`Retrieving webhook verification key for key ID: ${keyId}`);
    const plaidConfig = this.configProvider.getConfig();

    try {
      const response = await this.webhookVerificationKeyGet({
        client_id: plaidConfig.clientId,
        secret: plaidConfig.secret,
        key_id: keyId,
      });

      this.logger.log(`Successfully retrieved webhook verification key for key ID: ${keyId}`);
      return response.data;
    } catch (err) {
      const e = err as AxiosError;
      this.logger.error(
        `Failed to retrieve webhook verification key for key ID: ${keyId}`,
        e.response?.data ?? e.message,
      );
      throw new InternalServerErrorException(
        `Failed to retrieve webhook verification key: ${JSON.stringify(e.response?.data ?? e.message)}`,
      );
    }
  }

  async refreshUserAuthData(request: RefreshAuthDataRequest): Promise<RefreshAuthDataResponse> {
    this.logger.debug(`Refreshing auth data for account ${request.accountRef}`);
    const plaidConfig = this.configProvider.getConfig();

    try {
      const response = await this.authGet({
        client_id: plaidConfig.clientId,
        secret: plaidConfig.secret,
        access_token: request.accessToken,
      });

      const authData = response.data;

      if (!authData?.accounts?.length) {
        throw new InternalServerErrorException('No accounts returned from Plaid auth endpoint');
      }

      // Find the account that matches the requested account reference
      const account = authData.accounts.find((acc) => acc.account_id === request.accountRef);

      if (!account) {
        throw new InternalServerErrorException(`Account ${request.accountRef} not found in auth response`);
      }

      const achNumbers = authData.numbers?.ach?.find((achInfo) => achInfo.account_id === request.accountRef);

      if (!achNumbers) {
        this.logger.warn(
          `No ACH numbers available for account ${request.accountRef}, returning auth data without account/routing numbers`,
        );
        return {
          requestRef: authData.request_id,
          mask: account.mask,
        };
      }

      this.logger.debug(`Successfully refreshed auth data for account ${request.accountRef}`);

      return {
        requestRef: authData.request_id,
        accountNumber: achNumbers.account,
        routingNumber: achNumbers.routing,
        mask: account.mask,
      };
    } catch (err) {
      const e = err as AxiosError;
      this.logger.error(`Failed to refresh auth data for account ${request.accountRef}`, e.response?.data ?? e.message);
      throw new InternalServerErrorException(`Failed to refresh auth data: ${e.message}`);
    }
  }
}
