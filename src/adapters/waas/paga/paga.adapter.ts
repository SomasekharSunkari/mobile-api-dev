import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import { DateTime } from 'luxon';
import { add, subtract } from 'mathjs';
import { CurrencyUtility, SUPPORTED_CURRENCIES } from '../../../currencies';
import { PagaLedgerTransactionModel } from '../../../database/models/pagaLedgerTransaction';
import { PagaLedgerAccountRepository } from '../../../modules/pagaLedgerAccount/pagaLedgerAccount.repository';
import { PagaLedgerAccountService } from '../../../modules/pagaLedgerAccount/pagaLedgerAccount.service';
import { PagaLedgerTransactionService } from '../../../modules/pagaLedgerTransaction/pagaLedgerTransaction.service';
import { LockerService } from '../../../services/locker';
import { UtilsService } from '../../../utils/utils.service';
import {
  BankTransaction,
  CheckLedgerBalancePayload,
  CheckLedgerBalanceResponse,
  CreditTransactionPayload,
  DebitTransactionPayload,
  DeleteVirtualAccountPayload,
  DeleteVirtualAccountResponse,
  GetBankTransactionsPayload,
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
  WaasTransactionStatus,
  WaasTransferToOtherBankResponse,
  WaasTransferToSameBankResponse,
  WaasUpgradeAccountToTierThreePayload,
  WaasUpgradeAccountToTierThreeResponse,
  WaasUpgradeVirtualAccountPayload,
  WaasUpgradeVirtualAccountResponse,
} from '../waas.adapter.interface';
import { PagaAxiosHelper } from './paga.axios';
import {
  PagaCreatePersistentPaymentAccountPayload,
  PagaCreatePersistentPaymentAccountResponse,
  PagaDeletePersistentAccountPayload,
  PagaDeletePersistentAccountResponse,
  PagaDepositToBankPayload,
  PagaDepositToBankResponse,
  PagaGetAccountBalancePayload,
  PagaGetAccountBalanceResponse,
  PagaGetBankListPayload,
  PagaGetBankListResponse,
  PagaGetTransactionHistoryPayload,
  PagaGetTransactionHistoryResponse,
  PagaGetTransactionStatusPayload,
  PagaGetTransactionStatusResponse,
  PagaGetVirtualAccountPayload,
  PagaGetVirtualAccountResponse,
  PagaTransactionStatusEnum,
  PagaTransactionType,
  PagaUpdateVirtualAccountPayload,
  PagaUpdateVirtualAccountResponse,
  PagaVerifyBankAccountPayload,
  PagaVerifyBankAccountResponse,
} from './paga.interface';

@Injectable()
export class PagaAdapter extends PagaAxiosHelper implements WaasManagement {
  @Inject(PagaLedgerTransactionService)
  private readonly pagaLedgerTransactionService: PagaLedgerTransactionService;

  @Inject(forwardRef(() => PagaLedgerAccountService))
  private readonly pagaLedgerAccountService: PagaLedgerAccountService;

  @Inject(forwardRef(() => PagaLedgerAccountRepository))
  private readonly pagaLedgerAccountRepository: PagaLedgerAccountRepository;

  @Inject(LockerService)
  private readonly lockerService: LockerService;

  protected readonly logger = new Logger(PagaAdapter.name);
  async createBank(payload: VirtualPermanentAccountPayload): Promise<VirtualPermanentAccountResponse> {
    const lockKey = `paga-ledger-account:${payload.ref}:create-bank`;

    return await this.lockerService.withLock(lockKey, async () => {
      try {
        const body: PagaCreatePersistentPaymentAccountPayload = {
          referenceNumber: payload.ref,
          accountName: payload.first_name + ' ' + payload.last_name,
          accountReference: payload.ref,
          firstName: payload.first_name,
          lastName: payload.last_name,
          email: payload.email,
          phoneNumber: payload.phone_number,
        };

        if (this.checkIfPhoneNumberExceedsMaxLength(payload.phone_number)) {
          delete body.phoneNumber;
        }

        if (payload.funding_limit) {
          body.fundingTransactionLimit = payload.funding_limit;
        }

        if (payload.bvn) {
          body.financialIdentificationNumber = payload.bvn;
        }

        const hashParams: string[] = [body.accountReference];

        if (body.financialIdentificationNumber) {
          hashParams.push(body.financialIdentificationNumber);
        }
        if (body.creditBankId) {
          hashParams.push(body.creditBankId);
        }
        if (body.creditBankAccountNumber) {
          hashParams.push(body.creditBankAccountNumber);
        }
        if (body.callbackUrl) {
          hashParams.push(body.callbackUrl);
        }

        const response = await this.post<
          PagaCreatePersistentPaymentAccountPayload,
          PagaCreatePersistentPaymentAccountResponse
        >('/registerPersistentPaymentAccount', body, hashParams);

        if (response.data.statusCode !== '0') {
          throw new InternalServerErrorException(response.data.statusMessage);
        }

        await this.pagaLedgerAccountService.findOrCreate({
          account_number: response.data.accountNumber,
          account_name: body.accountName,
          email: body.email,
          phone_number: body.phoneNumber,
          available_balance: 0,
        });

        return {
          account_number: response.data.accountNumber,
          account_name: body.accountName,
          bank_name: this.getProviderName(),
          provider_ref: body.accountReference,
          provider_id: this.getProviderName(),
          provider_name: this.getProviderName(),
          provider_balance: 0,
          account_type: 'virtual',
          account_sub_type: 'persistent',
          amount: 0,
          order_ref: body.referenceNumber,
        };
      } catch (error) {
        const errorMessage = error?.response?.data?.statusMessage || error.message;
        throw new InternalServerErrorException(errorMessage);
      }
    });
  }

  private checkIfPhoneNumberExceedsMaxLength(phoneNumber: string): boolean {
    return phoneNumber.length > 11;
  }

  getProviderName(): string {
    return 'paga';
  }

  async checkUpgradeStatus(payload: WaasCheckUpgradeStatusPayload): Promise<WaasCheckUpgradeStatusResponse> {
    this.logger.log('PaymentAdapter.checkUpgradeStatus', payload);
    throw new NotImplementedException();
  }

  async upgradeVirtualAccount(payload: WaasUpgradeVirtualAccountPayload): Promise<WaasUpgradeVirtualAccountResponse> {
    this.logger.log('PaymentAdapter.upgradeVirtualAccount', payload);
    throw new NotImplementedException();
  }

  async creditBank(payload: CreditTransactionPayload<any>): Promise<any> {
    this.logger.log('PaymentAdapter.creditBank', payload);
    throw new NotImplementedException();
  }

  async getBankList(payload?: WaasGetBankListPayload): Promise<WaasGetBankListResponse[]> {
    try {
      const referenceNumber = payload?.ref || this.generateReferenceNumber();

      const response = await this.post<PagaGetBankListPayload, PagaGetBankListResponse>(
        '/banks',
        {
          referenceNumber: referenceNumber,
        },
        [],
        false,
        { validateStatus: () => true },
      );

      const data = response.data;

      if (!data?.banks) {
        this.logger.error(`getBankList: Invalid response from Paga API: ${JSON.stringify(data)}`);
        throw new InternalServerErrorException('Failed to get bank list from provider');
      }

      const banks = data.banks.map((bank) => ({
        bankName: bank.name,
        bankCode: bank.interInstitutionCode,
        nibssBankCode: bank.sortCode,
        bankRef: bank.uuid,
      }));

      return banks;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  private generateReferenceNumber(): string {
    return UtilsService.generateCode(11);
  }

  getBankCode(): string {
    return '327';
  }

  async findOrCreateVirtualAccount(payload: VirtualPermanentAccountPayload): Promise<VirtualPermanentAccountResponse> {
    try {
      this.logger.log('PaymentAdapter.findOrCreateVirtualAccount', payload);
      const account = await this.getVirtualAccount({ accountNumber: payload.ref, ref: payload.ref });

      if (account?.accountName && account?.accountNumber) {
        return {
          account_number: account.accountNumber,
          account_name: account.accountName,
          bank_name: this.getProviderName(),
          provider_ref: account.ref,
          provider_id: this.getProviderName(),
          provider_name: this.getProviderName(),
          provider_balance: 0,
          account_type: 'virtual',
          account_sub_type: 'persistent',
          amount: 0,
          order_ref: account.ref,
        };
      }

      const response = await this.createBank(payload);

      return response;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  debitBank(payload: DebitTransactionPayload<any>): Promise<any> {
    this.logger.log('PaymentAdapter.debitBank', payload);
    throw new NotImplementedException();
  }

  async getVirtualAccount(payload: GetWalletPayload): Promise<GetWalletResponse | undefined> {
    try {
      this.logger.log('PaymentAdapter.getVirtualAccount', payload);

      const hashParams: string[] = [payload.accountNumber];

      const response = await this.post<PagaGetVirtualAccountPayload, PagaGetVirtualAccountResponse>(
        '/getPersistentPaymentAccount',
        {
          referenceNumber: payload.ref,
          accountIdentifier: payload.accountNumber || payload.ref,
        },
        hashParams,
        false,
        {
          validateStatus: () => true,
        },
      );

      const data = response.data;

      if (!data.accountNumber) {
        return undefined;
      }

      return {
        accountName: data.accountName,
        address: null,
        accountNumber: data.accountNumber,
        bankCode: this.getBankCode(),
        bankName: this.getProviderName(),
        bvn: data.financialIdentificationNumber,
        ref: data.referenceNumber,
        phoneNumber: data.phoneNumber,
        merchantId: null,
        callBackUrl: data.callbackUrl,
      };
    } catch (error) {
      const message = error?.response?.data?.statusMessage || error.message;
      throw new InternalServerErrorException(message);
    }
  }

  async getWalletDetails(payload: GetWalletDetailsPayload): Promise<GetWalletDetailsResponse> {
    try {
      this.logger.log('PaymentAdapter.getVirtualAccount', payload);

      const hashParams: string[] = [payload.accountNo];

      const response = await this.post<PagaGetVirtualAccountPayload, PagaGetVirtualAccountResponse>(
        '/getPersistentPaymentAccount',
        {
          referenceNumber: payload.ref,
          accountIdentifier: payload.accountNo || payload.ref,
        },
        hashParams,
      );

      const data = response.data;

      return {
        accountName: data.accountName,
        address: null,
        accountNumber: data.accountNumber,
        bankCode: this.getBankCode(),
        bankName: this.getProviderName(),
        bvn: data.financialIdentificationNumber,
        ref: data.referenceNumber,
        phoneNumber: data.phoneNumber,
        callbackUrl: data.callbackUrl,
      };
    } catch (error) {
      const message = error?.response?.data?.statusMessage || error.message;
      throw new InternalServerErrorException(message);
    }
  }

  processTransferInflowWebhook(payload: WaasProcessWebhookPayload): Promise<WaasProcessWebhookResponse> {
    this.logger.log('PaymentAdapter.processTransferInflowWebhook', payload);
    throw new NotImplementedException();
  }

  upgradeAccountToTierThreeMultipart(
    payload: WaasUpgradeAccountToTierThreePayload,
  ): Promise<WaasUpgradeAccountToTierThreeResponse> {
    this.logger.log('PaymentAdapter.upgradeAccountToTierThreeMultipart', payload);
    throw new NotImplementedException();
  }

  async getTransactions(payload: GetBankTransactionsPayload): Promise<BankTransaction[]> {
    try {
      this.logger.log('PaymentAdapter.getTransactions', payload);
      const body: PagaGetTransactionHistoryPayload = {
        referenceNumber: payload.ref || payload.accountNumber,
        startDateUTC: '',
        endDateUTC: '',
      };

      if (payload.fromDate) {
        body.startDateUTC = DateTime.fromFormat(payload.fromDate, 'yyyy-MM-dd').toUTC() as any;
      }
      if (payload.toDate) {
        body.endDateUTC = DateTime.fromFormat(payload.toDate, 'yyyy-MM-dd').toUTC() as any;
      }

      const response = await this.post<PagaGetTransactionHistoryPayload, PagaGetTransactionHistoryResponse>(
        '/transactionHistory',
        body,
        [],
        true,
      );

      const data = response.data?.items ?? [];

      return data.map((item) => ({
        id: item.transactionId,
        externalTxId: item.transactionReference,
        status: item.status,
        operation: item.transactionType,
        amount: item.amount,
        isReversed: item.reversalId !== null,
        isCredit: this.checkIfItIsCredit(item.transactionType),
        isDebit: !this.checkIfItIsCredit(item.transactionType),
        balanceAfter: null,
        balanceBefore: null,
        currency: item.currency,
        fee: item.fee,
        tax: item.tax,
        transactionType: item.transactionType,
        transactionChannel: item.transactionChannel,
        reversalId: item.reversalId,
        createdAt: DateTime.fromMillis(item.dateUTC).toFormat('yyyy-MM-dd'),
        lastUpdated: DateTime.fromMillis(item.dateUTC).toFormat('yyyy-MM-dd'),
        narration: item.description,
        referenceNo: item.referenceNumber,
        transactionDate: DateTime.fromMillis(item.dateUTC).toFormat('yyyy-MM-dd'),
        transactionDateString: new Date(item.dateUTC).toISOString(),
        accountNumber: null,
      }));
    } catch (error) {
      const errorMessage = error?.response?.data?.errorMessage || error.message;
      throw new InternalServerErrorException(errorMessage);
    }
  }

  private checkIfItIsCredit(type: PagaTransactionType | string): boolean {
    if (type?.toLowerCase() === PagaTransactionType.MERCHANT_PAYMENT_VIRTUAL_ACCOUNT_TRANSFER.toLowerCase()) {
      return true;
    }
    if (type?.toLowerCase() === PagaTransactionType.USER_DEPOSIT_FROM_BANK_ACCOUNT.toLowerCase()) {
      return true;
    }
    if (type?.toLowerCase() === PagaTransactionType.USER_SEND_CASH_TO_BANK_ACCOUNT_SETTLED.toLowerCase()) {
      return false;
    }
    return false;
  }

  async transferToOtherBank(payload: TransferToOtherBankPayload): Promise<WaasTransferToOtherBankResponse> {
    const lockKey = `paga-ledger-account:${payload.sender.accountNumber}:transfer-to-other-bank`;
    let pagaLedgerTransaction: PagaLedgerTransactionModel;
    return await this.lockerService.withLock(lockKey, async () => {
      try {
        this.logger.log('PaymentAdapter.transferToOtherBank', payload);
        const hashParams: string[] = [payload.amount?.toString()];

        if (payload.receiver.bankRef) {
          hashParams.push(payload.receiver.bankRef);
        }

        if (payload.receiver.accountNumber) {
          hashParams.push(payload.receiver.accountNumber);
        }

        const body: PagaDepositToBankPayload = {
          referenceNumber: payload.transactionReference,
          amount: payload.amount,
          destinationBankAccountNumber: payload.receiver.accountNumber,
          destinationBankUUID: payload.receiver.bankRef,
          remarks: payload.description,
        };

        const pagaLedgerAccount = await this.pagaLedgerAccountService.findOne({
          account_number: payload.sender.accountNumber,
        });

        if (!pagaLedgerAccount) {
          throw new InternalServerErrorException('Paga ledger account not found');
        }

        const amountInKobo = CurrencyUtility.formatCurrencyAmountToSmallestUnit(
          payload.amount,
          SUPPORTED_CURRENCIES.NGN.code,
        );

        // check if the amount is greater than the balance
        if (amountInKobo > Number(pagaLedgerAccount.available_balance)) {
          throw new BadRequestException('Insufficient balance');
        }

        const balanceBefore = Number(pagaLedgerAccount.available_balance);
        const balanceAfter = subtract(balanceBefore, amountInKobo);

        pagaLedgerTransaction = await this.pagaLedgerTransactionService.create({
          account_number: payload.sender.accountNumber,
          amount: amountInKobo,
          status: 'PENDING',
          reference_number: payload.transactionReference,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          transaction_type: 'DEBIT',
          currency: payload.currency,
          transaction_reference: payload.transactionReference,
          transaction_id: payload.transactionReference,
          source_account_name: payload.sender.accountNumber,
          description: payload.description,
        });

        const response = await this.post<PagaDepositToBankPayload, PagaDepositToBankResponse>(
          '/depositToBank',
          body,
          hashParams,
          true,
        );

        const data = response.data;

        if (data.responseCode === 0) {
          await this.pagaLedgerAccountRepository.transaction(async (trx) => {
            await this.pagaLedgerTransactionService.update(pagaLedgerTransaction.id, 'SUCCESSFUL', trx);
            await this.pagaLedgerAccountService.updateBalance(
              payload.sender.accountNumber,
              Number(-amountInKobo),
              pagaLedgerTransaction.id,
              trx,
            );
          });
        } else {
          await this.pagaLedgerTransactionService.update(pagaLedgerTransaction.id, 'FAILED');
        }

        return {
          transactionReference: data.referenceNumber,
          sender: payload.sender,
          receiver: payload.receiver,
          amount: payload.amount,
          country: 'NG',
          transactionType: 'INTRA_BANK',
          narration: payload.description,
          currency: payload.currency,
        };
      } catch (error) {
        const errorMessage = error?.response?.data?.errorMessage || error.message;
        if (pagaLedgerTransaction) {
          await this.pagaLedgerTransactionService.update(pagaLedgerTransaction.id, 'FAILED');
        }
        throw new InternalServerErrorException(errorMessage);
      }
    });
  }

  async transferToSameBank(payload: TransferToSameBankPayload): Promise<WaasTransferToSameBankResponse> {
    const lockKey = `paga-ledger-account:${payload.sender.accountNumber}:transfer-to-same-bank`;
    return await this.lockerService.withLock(lockKey, async () => {
      try {
        this.logger.log('Transfer to same bank', payload);

        // get the sender ledger account and the receiver ledger account
        const senderLedgerAccount = await this.pagaLedgerAccountService.findOne({
          account_number: payload.sender.accountNumber,
        });

        if (!senderLedgerAccount) {
          throw new InternalServerErrorException('Sender Paga ledger account not found');
        }

        const receiverLedgerAccount = await this.pagaLedgerAccountService.findOne({
          account_number: payload.receiver.accountNumber,
        });

        if (!receiverLedgerAccount) {
          throw new InternalServerErrorException('Receiver Paga ledger account not found');
        }

        // check if they have enough balance
        const amountInKobo = CurrencyUtility.formatCurrencyAmountToSmallestUnit(
          payload.amount,
          SUPPORTED_CURRENCIES.NGN.code,
        );
        if (amountInKobo > senderLedgerAccount.available_balance) {
          throw new BadRequestException('Insufficient balance');
        }

        // create a paga ledger transaction in PENDING state
        const senderBalanceBefore = Number(senderLedgerAccount.available_balance);
        const senderBalanceAfter = subtract(senderBalanceBefore, amountInKobo);

        const senderPagaLedgerTransaction = await this.pagaLedgerTransactionService.create({
          account_number: payload.sender.accountNumber,
          amount: amountInKobo,
          status: 'PENDING',
          reference_number: payload.transactionReference,
          balance_before: senderBalanceBefore,
          balance_after: senderBalanceAfter,
          transaction_type: 'DEBIT',
          currency: payload.currency,
          transaction_reference: payload.transactionReference,
          transaction_id: payload.transactionReference,
          source_account_name: payload.sender.accountNumber,
        });

        // create a paga ledger transaction in PENDING state
        const receiverBalanceBefore = Number(receiverLedgerAccount.available_balance);
        const receiverBalanceAfter = add(receiverBalanceBefore, amountInKobo);
        const referenceNumber = UtilsService.generateCode(17);

        const receiverPagaLedgerTransaction = await this.pagaLedgerTransactionService.create({
          account_number: payload.receiver.accountNumber,
          amount: amountInKobo,
          status: 'PENDING',
          reference_number: referenceNumber,
          balance_before: receiverBalanceBefore,
          balance_after: receiverBalanceAfter,
          transaction_type: 'CREDIT',
          currency: payload.currency,
          transaction_reference: payload.transactionReference,
          transaction_id: payload.transactionReference,
          source_account_name: payload.sender.accountNumber,
        });

        await this.pagaLedgerAccountService.updateBalance(
          payload.sender.accountNumber,
          Number(-amountInKobo),
          senderPagaLedgerTransaction.id,
        );

        await this.pagaLedgerAccountService.updateBalance(
          payload.receiver.accountNumber,
          Number(amountInKobo),
          receiverPagaLedgerTransaction.id,
        );

        return {
          transactionReference: payload.transactionReference,
          sender: payload.sender,
          receiver: payload.receiver,
          amount: payload.amount,
          currency: payload.currency,
          country: 'NG',
          providerRef: payload.transactionReference,
        };
      } catch (error) {
        const errorMessage = error?.response?.data?.errorMessage || error.message;
        throw new InternalServerErrorException(errorMessage);
      }
    });
  }
  async getTransactionStatus(payload: GetTransactionStatusPayload): Promise<GetTransactionStatusResponse> {
    try {
      this.logger.log('PaymentAdapter.getTransactionStatus', payload);
      const response = await this.post<PagaGetTransactionStatusPayload, PagaGetTransactionStatusResponse>(
        '/transactionStatus',
        {
          referenceNumber: payload.transactionRef,
        },
        [],
        true,
        {
          validateStatus() {
            return true;
          },
        },
      );

      const data = response.data;

      return {
        status: this.transformToTransactionStatus(data.status),
        message: data.message,
      };
    } catch (error) {
      const errorMessage = error?.response?.data?.message || error.message;
      throw new InternalServerErrorException(errorMessage);
    }
  }

  private transformToTransactionStatus(status: string): WaasTransactionStatus {
    if (status?.toLowerCase() === PagaTransactionStatusEnum.SUCCESSFUL.toLowerCase()) {
      return WaasTransactionStatus.SUCCESS;
    }

    if (status?.toLowerCase() === PagaTransactionStatusEnum.FAILED.toLowerCase()) {
      return WaasTransactionStatus.FAILED;
    }

    return WaasTransactionStatus.PENDING;
  }

  async verifyBankAccount(payload: VerifyBankAccountPayload): Promise<VerifyBankAccountResponse> {
    try {
      this.logger.log('PaymentAdapter.verifyBankAccount', payload);

      // get the bank list;
      const bankList = await this.getBankList();

      // find the bank uuid from the bank list;
      const bank = bankList.find((bank) => {
        return bank.bankRef?.toLowerCase() === payload.bankRef?.toLowerCase();
      });

      const body: PagaVerifyBankAccountPayload = {
        referenceNumber: this.generateReferenceNumber(),
        amount: payload.amount,
        destinationBankUUID: bank.bankRef,
        destinationBankAccountNumber: payload.accountNumber,
      };

      const hashParams: string[] = [body.amount];

      if (body.destinationBankUUID) {
        hashParams.push(body.destinationBankUUID);
      }

      if (body.destinationBankAccountNumber) {
        hashParams.push(body.destinationBankAccountNumber);
      }

      const response = await this.post<PagaVerifyBankAccountPayload, PagaVerifyBankAccountResponse>(
        '/validateDepositToBank',
        body,
        hashParams,
        true,
      );

      const data = response.data;

      if (!data) {
        throw new InternalServerErrorException('Error while verifying bank account');
      }

      if (data.responseCode !== 0) {
        throw new InternalServerErrorException(data.message);
      }

      return {
        accountName: data.destinationAccountHolderNameAtBank,
        accountNumber: payload.accountNumber,
        bankName: bank.bankName,
        bankCode: payload.bankCode,
        bankRef: bank.bankRef,
      };
    } catch (error) {
      const errorMessage = error?.response?.data?.statusMessage || error.message;
      throw new InternalServerErrorException(errorMessage);
    }
  }

  /**
   * Update a persistent payment account on Paga.
   * Hash params: accountIdentifier + financialIdentificationNumber + creditBankId
   *              + creditBankAccountNumber + callbackUrl + hashkey
   */
  async updateVirtualAccount(payload: UpdateVirtualAccountPayload): Promise<UpdateVirtualAccountResponse> {
    try {
      this.logger.log('PaymentAdapter.updateVirtualAccount', payload);

      const body: PagaUpdateVirtualAccountPayload = {
        referenceNumber: payload.ref || this.generateReferenceNumber(),
        accountIdentifier: payload.accountNumber || payload.ref,
      };

      if (payload.phoneNumber) {
        body.phoneNumber = payload.phoneNumber;
      }
      if (payload.firstName) {
        body.firstName = payload.firstName;
      }
      if (payload.lastName) {
        body.lastName = payload.lastName;
      }
      if (payload.accountName) {
        body.accountName = payload.accountName;
      }
      if (payload.bvn) {
        body.financialIdentificationNumber = payload.bvn;
      }
      if (payload.callbackUrl) {
        body.callbackUrl = payload.callbackUrl;
      }
      if (payload.creditBankId) {
        body.creditBankId = payload.creditBankId;
      }
      if (payload.creditBankAccountNumber) {
        body.creditBankAccountNumber = payload.creditBankAccountNumber;
      }

      // Hash params: accountIdentifier + financialIdentificationNumber + creditBankId
      // + creditBankAccountNumber + callbackUrl
      const hashParams: string[] = [body.accountIdentifier];

      if (body.financialIdentificationNumber) {
        hashParams.push(body.financialIdentificationNumber);
      }
      if (body.creditBankId) {
        hashParams.push(body.creditBankId);
      }
      if (body.creditBankAccountNumber) {
        hashParams.push(body.creditBankAccountNumber);
      }
      if (body.callbackUrl) {
        hashParams.push(body.callbackUrl);
      }

      const response = await this.post<PagaUpdateVirtualAccountPayload, PagaUpdateVirtualAccountResponse>(
        '/updatePersistentPaymentAccount',
        body,
        hashParams,
      );

      if (response.data.statusCode !== '0') {
        throw new InternalServerErrorException(response.data.statusMessage);
      }

      const data = response.data;

      return {
        status: data.statusCode === '0' ? 'success' : 'failed',
        message: data.statusMessage,
        ref: body.referenceNumber,
      };
    } catch (error) {
      const errorMessage = error?.response?.data?.statusMessage || error.message;
      throw new InternalServerErrorException(errorMessage);
    }
  }

  /**
   * Delete a persistent payment account on Paga.
   * Hash params order: referenceNumber + accountIdentifier + hashkey
   */
  async deleteVirtualAccount(payload: DeleteVirtualAccountPayload): Promise<DeleteVirtualAccountResponse> {
    try {
      this.logger.log('PaymentAdapter.deleteVirtualAccount', payload);

      const body: PagaDeletePersistentAccountPayload = {
        referenceNumber: payload.ref,
        accountIdentifier: payload.accountNumber || payload.ref,
      };

      if (payload.reason) {
        body.reason = payload.reason;
      }

      // Hash params: referenceNumber + accountIdentifier
      const hashParams: string[] = [body.accountIdentifier];

      const response = await this.post<PagaDeletePersistentAccountPayload, PagaDeletePersistentAccountResponse>(
        '/deletePersistentPaymentAccount',
        body,
        hashParams,
      );

      if (response.data.statusCode !== '0') {
        throw new InternalServerErrorException(response.data.statusMessage);
      }

      if (payload.isMainAccount) {
        await this.pagaLedgerAccountService.delete(payload.accountNumber);
      }

      return {
        status: 'success',
        message: response.data.statusMessage,
      };
    } catch (error) {
      const errorMessage = error?.response?.data?.message || error.message;

      throw new InternalServerErrorException(errorMessage);
    }
  }

  async checkLedgerBalance(payload: CheckLedgerBalancePayload): Promise<CheckLedgerBalanceResponse> {
    const { accountNumber, amount, currency } = payload;

    const pagaLedgerAccount = await this.pagaLedgerAccountService.findOne({
      account_number: accountNumber,
    });

    if (!pagaLedgerAccount) {
      throw new NotFoundException('Paga ledger account not found');
    }

    const amountInKobo = CurrencyUtility.formatCurrencyAmountToSmallestUnit(amount, currency);
    const availableBalance = Number(pagaLedgerAccount.available_balance);

    return {
      hasSufficientBalance: amountInKobo <= availableBalance,
      availableBalance,
      requestedAmount: amountInKobo,
    };
  }

  /**
   * Get the actual Paga business account balance from Paga API
   * Returns the available balance in the smallest currency unit (kobo)
   */
  async getBusinessAccountBalance(): Promise<{
    totalBalance: number;
    availableBalance: number;
    currency: string;
  }> {
    try {
      const referenceNumber = this.generateReferenceNumber();

      const response = await this.post<PagaGetAccountBalancePayload, PagaGetAccountBalanceResponse>(
        '/accountBalance',
        { referenceNumber },
        [],
        true,
      );

      const data = response.data;

      if (data.responseCode !== 0) {
        throw new InternalServerErrorException(data.message || 'Failed to fetch Paga business balance');
      }

      return {
        totalBalance: data.totalBalance,
        availableBalance: data.availableBalance,
        currency: data.currency || 'NGN',
      };
    } catch (error) {
      this.logger.error(`Error fetching Paga business balance: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to fetch Paga business account balance');
    }
  }
}
