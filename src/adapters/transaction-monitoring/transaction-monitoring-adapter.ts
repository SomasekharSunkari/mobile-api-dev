import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  IpCheckPayload,
  IpCheckForApplicantPayload,
  IpCheckResponse,
  SubmitTransactionPayload,
  SubmitTransactionResponse,
  TransactionMonitoringInterface,
} from './transaction-monitoring-adapter.interface';
import { SumsubTransactionMonitoringAdapter } from './sumsub/sumsub-transaction-monitoring.adapter';

@Injectable()
export class TransactionMonitoringAdapter implements TransactionMonitoringInterface {
  @Inject(SumsubTransactionMonitoringAdapter)
  private readonly sumsubTransactionMonitoringAdapter: SumsubTransactionMonitoringAdapter;

  private getProvider(): TransactionMonitoringInterface {
    const providerKey = this.getProviderName();

    if (!providerKey) {
      throw new BadRequestException(`No transaction monitoring provider configured`);
    }

    if (providerKey === 'sumsub') {
      return this.sumsubTransactionMonitoringAdapter;
    }

    throw new BadRequestException(`Unsupported transaction monitoring provider: ${providerKey}`);
  }

  getProviderName(): string {
    // For now, default to sumsub since that's what we're using for IP checks
    return 'sumsub';
  }

  async ipCheck(payload: IpCheckPayload): Promise<IpCheckResponse> {
    const provider = this.getProvider();
    return await provider.ipCheck(payload);
  }

  async ipCheckForApplicant(payload: IpCheckForApplicantPayload): Promise<IpCheckResponse> {
    const provider = this.getProvider();
    return await provider.ipCheckForApplicant(payload);
  }

  async submitTransaction(payload: SubmitTransactionPayload): Promise<SubmitTransactionResponse> {
    const provider = this.getProvider();
    return await provider.submitTransaction(payload);
  }
}
