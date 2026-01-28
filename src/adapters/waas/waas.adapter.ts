import { Inject, Injectable, InternalServerErrorException, Logger, NotImplementedException } from '@nestjs/common';
import { EnvironmentService } from '../../config';
import { PagaAdapter } from './paga/paga.adapter';
import {
  BankTransaction,
  CheckLedgerBalancePayload,
  CheckLedgerBalanceResponse,
  CreditTransactionPayload,
  DebitTransactionPayload,
  DeleteVirtualAccountPayload,
  DeleteVirtualAccountResponse,
  GetBankTransactionsPayload,
  GetTotalBusinessAccountBalanceResponse,
  GetTransactionStatusPayload,
  GetTransactionStatusResponse,
  GetWalletDetailsPayload,
  GetWalletDetailsResponse,
  GetWalletPayload,
  GetWalletResponse,
  TransferToOtherBankPayload,
  TransferToSameBankPayload,
  UpdateVirtualAccountPayload,
  UpdateVirtualAccountResponse,
  VerifyBankAccountPayload,
  VerifyBankAccountResponse,
  VirtualPermanentAccountPayload,
  VirtualPermanentAccountResponse,
  WaasCheckUpgradeStatusPayload,
  WaasCheckUpgradeStatusResponse,
  WaasGetBankListPayload,
  WaasGetBankListResponse,
  WaasManagement,
  WaasProcessWebhookPayload,
  WaasProcessWebhookResponse,
  WaasTransferToOtherBankResponse,
  WaasTransferToSameBankResponse,
  WaasUpgradeAccountToTierThreePayload,
  WaasUpgradeAccountToTierThreeResponse,
  WaasUpgradeVirtualAccountPayload,
  WaasUpgradeVirtualAccountResponse,
} from './waas.adapter.interface';

@Injectable()
export class WaasAdapter implements WaasManagement {
  @Inject(PagaAdapter)
  private readonly pagaAdapter: PagaAdapter;

  protected readonly logger = new Logger(WaasAdapter.name);

  getProviderName(): string {
    const provider = this.getProvider();

    return provider.getProviderName();
  }

  getProvider(): WaasManagement {
    const provider = EnvironmentService.getValue('DEFAULT_NG_WAAS_ADAPTER');

    switch (provider) {
      case 'paga':
        return this.pagaAdapter;
    }
  }

  async createBank(payload: VirtualPermanentAccountPayload): Promise<VirtualPermanentAccountResponse> {
    try {
      const provider = this.getProvider();
      const response = await provider.createBank(payload);

      return response;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async findOrCreateVirtualAccount(payload: VirtualPermanentAccountPayload): Promise<VirtualPermanentAccountResponse> {
    try {
      const provider = this.getProvider();
      const response = await provider.findOrCreateVirtualAccount(payload);
      return response;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async processTransferInflowWebhook(payload: WaasProcessWebhookPayload): Promise<WaasProcessWebhookResponse> {
    this.logger.log('processWebhook', 'WaasAdapter');
    try {
      const provider = this.getProvider();
      const response = await provider.processTransferInflowWebhook(payload);
      return response;
    } catch (error) {
      this.logger.error(error, 'WaasAdapter.processTransferInflowWebhook'); // Log the error message
      throw new InternalServerErrorException(error.message);
    }
  }

  async creditBank(payload: CreditTransactionPayload<any>): Promise<any> {
    this.logger.log('creditBank', 'WaasAdapter');
    try {
      const provider = this.getProvider();
      const response = await provider.creditBank(payload);

      return response;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async getVirtualAccount(payload: GetWalletPayload): Promise<GetWalletResponse> {
    this.logger.log('getVirtualAccount', 'WaasAdapter');
    try {
      const provider = this.getProvider();
      let response;

      if (provider.getVirtualAccount) {
        response = await provider.getVirtualAccount(payload);
      }

      return response;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async getWalletDetails(payload: GetWalletDetailsPayload): Promise<GetWalletDetailsResponse> {
    this.logger.log('getWalletDetails', 'WaasAdapter');
    try {
      const provider = this.getProvider();
      const response = await provider.getWalletDetails(payload);

      return response;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async debitBankDetails(payload: DebitTransactionPayload<any>): Promise<any> {
    this.logger.log('debitBank', 'WaasAdapter');

    throw new NotImplementedException(`Not Implemented ${payload}`);
  }

  async getTransactions(payload: GetBankTransactionsPayload): Promise<BankTransaction[]> {
    try {
      const provider = this.getProvider();
      const response = await provider.getTransactions(payload);
      return response;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async upgradeVirtualAccount(payload: WaasUpgradeVirtualAccountPayload): Promise<WaasUpgradeVirtualAccountResponse> {
    try {
      const provider = this.getProvider();
      const response = await provider.upgradeVirtualAccount(payload);

      return response;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async upgradeAccountToTierThreeMultipart(
    payload: WaasUpgradeAccountToTierThreePayload,
  ): Promise<WaasUpgradeAccountToTierThreeResponse> {
    try {
      const provider = this.getProvider();
      const response = await provider.upgradeAccountToTierThreeMultipart(payload);

      return response;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async checkUpgradeStatus(payload: WaasCheckUpgradeStatusPayload): Promise<WaasCheckUpgradeStatusResponse> {
    try {
      const provider = this.getProvider();
      const response = await provider.checkUpgradeStatus(payload);

      return response;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async debitBank(payload: DebitTransactionPayload<any>): Promise<any> {
    try {
      const provider = this.getProvider();
      const response = await provider.debitBank(payload);

      return response;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async transferToOtherBank(payload: TransferToOtherBankPayload): Promise<WaasTransferToOtherBankResponse> {
    try {
      const provider = this.getProvider();
      const response = await provider.transferToOtherBank(payload);

      return response;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async transferToSameBank(payload: TransferToSameBankPayload): Promise<WaasTransferToSameBankResponse> {
    try {
      const provider = this.getProvider();
      const response = await provider.transferToSameBank(payload);
      return response;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async getBankList(payload?: WaasGetBankListPayload): Promise<WaasGetBankListResponse[]> {
    try {
      const provider = this.getProvider();
      const response = await provider.getBankList(payload);
      return response;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async getTransactionStatus(payload: GetTransactionStatusPayload): Promise<GetTransactionStatusResponse> {
    try {
      const provider = this.getProvider();
      const response = await provider.getTransactionStatus(payload);

      return response;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async verifyBankAccount(payload: VerifyBankAccountPayload): Promise<VerifyBankAccountResponse> {
    const provider = this.getProvider();
    const response = await provider.verifyBankAccount(payload);

    if (!response) {
      throw new InternalServerErrorException('Error while verifying bank account');
    }

    return response;
  }

  getBankCode(): string {
    const provider = this.getProvider();
    return provider.getBankCode();
  }

  async updateVirtualAccount(payload: UpdateVirtualAccountPayload): Promise<UpdateVirtualAccountResponse> {
    const provider = this.getProvider();
    const response = await provider.updateVirtualAccount(payload);

    return response;
  }

  async deleteVirtualAccount(payload: DeleteVirtualAccountPayload): Promise<DeleteVirtualAccountResponse> {
    throw new NotImplementedException(`Not Implemented: deleteVirtualAccount ${payload}`);
  }

  async checkLedgerBalance(payload: CheckLedgerBalancePayload): Promise<CheckLedgerBalanceResponse> {
    const provider = this.getProvider();
    const response = await provider.checkLedgerBalance(payload);

    return response;
  }

  async getBusinessAccountBalance(): Promise<GetTotalBusinessAccountBalanceResponse> {
    const provider = this.getProvider();
    const response = await provider.getBusinessAccountBalance();

    return response;
  }
}
