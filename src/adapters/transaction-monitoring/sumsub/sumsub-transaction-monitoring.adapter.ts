import { InternalServerErrorException, Logger } from '@nestjs/common';
import { UtilsService } from '../../../utils/utils.service';
import { AxiosResponse } from 'axios';
import {
  IpCheckPayload,
  IpCheckForApplicantPayload,
  IpCheckResponse,
  SubmitTransactionPayload,
  SubmitTransactionResponse,
  TransactionMonitoringInterface,
  TransactionType,
  TransactionDirection,
} from '../transaction-monitoring-adapter.interface';
import { SumsubKycServiceAxiosHelper } from '../../kyc/sumsub/sumsub.axios';
import {
  SumsubIpCheckRequest,
  SumsubIpCheckResponse,
  SumsubApplicantIpCheckRequest,
  SumsubTransactionRequest,
  SumsubTransactionResponse,
} from './sumsub-transaction-monitoring.interface';

export class SumsubTransactionMonitoringAdapter
  extends SumsubKycServiceAxiosHelper
  implements TransactionMonitoringInterface
{
  protected readonly logger = new Logger(SumsubTransactionMonitoringAdapter.name);

  async ipCheck({ ipAddress, userId }: IpCheckPayload): Promise<IpCheckResponse> {
    try {
      // Generate unique transaction ID for this check
      const txnId = UtilsService.generateTransactionReference();

      const requestPayload: SumsubIpCheckRequest = {
        txnId,
        type: 'userPlatformEvent',
        applicant: {
          externalUserId: userId,
          device: {
            ipInfo: {
              ip: ipAddress,
            },
          },
        },
      };

      const response = await this.post<SumsubIpCheckRequest, AxiosResponse<SumsubIpCheckResponse>>(
        '/resources/applicants/-/kyt/txns/-/data',
        requestPayload,
      );

      const data = response?.data?.data?.applicant?.device?.ipInfo;

      // Transform Sumsub response to our standard format
      const transformedData: IpCheckResponse = {
        city: data?.city || null,
        region: data?.state || null,
        country: data?.countryCode2 || null,
        isVpn: data?.vpn || false,
      };

      return transformedData;
    } catch (error) {
      this.logger.error('SumsubTransactionMonitoringAdapter.ipCheck', error);
      throw new InternalServerErrorException(error?.message);
    }
  }

  async ipCheckForApplicant({ ipAddress, applicantId }: IpCheckForApplicantPayload): Promise<IpCheckResponse> {
    try {
      // Generate unique transaction ID for this check
      const txnId = UtilsService.generateTransactionReference();

      const requestPayload: SumsubApplicantIpCheckRequest = {
        txnId,
        applicantId,
        type: 'userPlatformEvent',
        applicant: {
          device: {
            ipInfo: {
              ip: ipAddress,
            },
          },
        },
      };

      const response = await this.post<SumsubApplicantIpCheckRequest, AxiosResponse<SumsubIpCheckResponse>>(
        `/resources/applicants/${applicantId}/kyt/txns/-/data`,
        requestPayload,
      );

      const data = response?.data?.data?.applicant?.device?.ipInfo;

      // Transform Sumsub response to our standard format
      const transformedData: IpCheckResponse = {
        city: data?.city || null,
        region: data?.state || null,
        country: data?.countryCode2 || null,
        isVpn: data?.vpn || false,
      };

      return transformedData;
    } catch (error) {
      this.logger.error('SumsubTransactionMonitoringAdapter.ipCheckForApplicant', error);
      throw new InternalServerErrorException(error?.message);
    }
  }

  async submitTransaction(payload: SubmitTransactionPayload): Promise<SubmitTransactionResponse> {
    try {
      this.logger.log(`Submitting transaction ${payload.transactionId} for applicant ${payload.applicantId}`);

      // Transform generic payload to Sumsub-specific format
      const sumsubPayload: SumsubTransactionRequest = {
        txnId: payload.transactionId,
        txnDate: payload.transactionDate,
        zoneId: payload.timeZone,
        type: this.mapTransactionType(payload.transactionType),
        info: {
          direction: payload.direction === TransactionDirection.IN ? 'in' : 'out',
          amount: payload.amount,
          currencyCode: payload.currency,
          currencyType: 'fiat',
          paymentDetails: payload.description,
        },
        counterparty: {
          type: payload.counterparty.type,
          externalUserId: payload.counterparty.externalUserId,
          fullName: payload.counterparty.fullName,
          dob: payload.counterparty.dateOfBirth,
          address: {
            country: payload.counterparty.address.countryCode,
            postCode: payload.counterparty.address.postal,
            town: payload.counterparty.address.city,
            state: payload.counterparty.address.state,
            street: payload.counterparty.address.addressLine1,
            subStreet: payload.counterparty.address.addressLine2,
          },
          ...(payload.counterparty.bankAccount && {
            paymentMethod: {
              type: payload.counterparty.bankAccount.accountType,
              accountId: payload.counterparty.bankAccount.accountNumber,
              issuingCountry: payload.counterparty.bankAccount.countryCode,
            },
          }),
          ...(payload.counterparty.bankInfo && {
            institutionInfo: {
              name: payload.counterparty.bankInfo.bankName,
            },
          }),
        },
        applicant: {
          type: payload.participant.type,
          externalUserId: payload.participant.externalUserId,
          fullName: payload.participant.fullName,
          dob: payload.participant.dateOfBirth,
          address: {
            country: payload.participant.address.countryCode,
            postCode: payload.participant.address.postal,
            town: payload.participant.address.city,
            state: payload.participant.address.state,
            street: payload.participant.address.addressLine1,
            subStreet: payload.participant.address.addressLine2,
          },
          device: {
            fingerprint: payload.device.deviceFingerprint,
            ipInfo: {
              ip: payload.device.ipInfo.ipAddress,
            },
          },
        },
      };

      const response = await this.post<SumsubTransactionRequest, AxiosResponse<SumsubTransactionResponse>>(
        `/resources/applicants/${payload.applicantId}/kyt/txns/-/data`,
        sumsubPayload,
      );

      // Transform Sumsub response to our standard format
      const responseData = response.data;
      const transformedData: SubmitTransactionResponse = {
        transactionId: responseData.data.txnId,
        status: responseData.review?.reviewStatus || 'submitted',
        riskScore: responseData.score,
        decision: responseData.review?.reviewResult?.reviewAnswer,
        flaggedReasons: responseData.scoringResult?.failedRules?.map((rule) => rule.title),
        data: responseData,
      };

      this.logger.debug(`Transaction ${payload.transactionId} submitted successfully`);
      return transformedData;
    } catch (error) {
      this.logger.error('SumsubTransactionMonitoringAdapter.submitTransaction', error);
      this.logger.error('Error details:', {
        status: error?.response?.status,
        statusText: error?.response?.statusText,
        data: error?.response?.data,
        headers: error?.response?.headers,
      });
      throw new InternalServerErrorException(error?.message);
    }
  }

  private mapTransactionType(type: TransactionType): SumsubTransactionRequest['type'] {
    switch (type) {
      case TransactionType.FINANCE:
        return 'finance';
      case TransactionType.KYC:
        return 'kyc';
      case TransactionType.TRAVEL_RULE:
        return 'travelRule';
      case TransactionType.USER_PLATFORM_EVENT:
        return 'userPlatformEvent';
      default:
        return 'userPlatformEvent';
    }
  }
}
