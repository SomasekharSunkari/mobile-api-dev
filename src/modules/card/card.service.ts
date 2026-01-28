import { BadRequestException, Inject, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { DateTime } from 'luxon';
import { add, multiply, subtract } from 'mathjs';
import { CardAdapter } from '../../adapters/card/card.adapter';
import {
  CardChargeResponse,
  CardLimitFrequency,
  CardProvider,
  CardStatus,
  CardType,
  CreateCardRequest,
  CreateCardUserRequest,
  CreateCardUserStablecoinAddress,
  ShippingMethod,
} from '../../adapters/card/card.adapter.interface';
import { RainContractResponse, RainDisputeResponse } from '../../adapters/card/rain/rain.interface';
import { KYCAdapter } from '../../adapters/kyc/kyc-adapter';
import { EnvironmentService } from '../../config';
import { CardConfigProvider, DefaultCardLimit } from '../../config/card.config';
import {
  CARD_INITIAL_FUNDING_MIN_USD,
  CARD_SUBSEQUENT_FUNDING_MIN_USD,
  CardFeeType,
  CardFeesService,
  MAX_INSUFFICIENT_FUNDS_DECLINES,
  MINIMUM_CHARGE_API_FEE,
} from '../../config/onedosh/cardFees.config';
import { StableCoinsService } from '../../config/onedosh/stablecoins.config';
import { RainConfigProvider } from '../../config/rain.config';
import { BLOCKCHAIN_ACCOUNT_RAIL } from '../../constants/blockchainAccountRails';
import { CurrencyCode, CurrencyUtility, SUPPORTED_CURRENCIES } from '../../currencies/currencies';
import { IPaginatedResponse } from '../../database';
import { ICard, ICardStatus, IIssuanceFeeStatus } from '../../database/models/card/card.interface';
import {
  CardTransactionDrCr,
  CardTransactionStatus,
  CardTransactionType,
  ICardTransaction,
} from '../../database/models/cardTransaction/cardTransaction.interface';
import { CardTransactionModel } from '../../database/models/cardTransaction/cardTransaction.model';
import {
  CardTransactionDisputeStatus,
  ICardTransactionDispute,
} from '../../database/models/cardTransactionDispute/cardTransactionDispute.interface';
import {
  CardTransactionDisputeEventType,
  CardTransactionDisputeTriggeredBy,
  ICardTransactionDisputeEvent,
} from '../../database/models/cardTransactionDisputeEvent/cardTransactionDisputeEvent.interface';
import { CardTransactionDisputeEventModel } from '../../database/models/cardTransactionDisputeEvent/cardTransactionDisputeEvent.model';
import { ICardUser, ICardUserStatus } from '../../database/models/cardUser';
import { KycVerificationModel } from '../../database/models/kycVerification/kycVerification.model';
import { PlatformServiceKey } from '../../database/models/platformStatus/platformStatus.interface';
import {
  ITransaction,
  TransactionCategory,
  TransactionScope,
  TransactionStatus,
  TransactionType,
} from '../../database/models/transaction/transaction.interface';
import { UserModel } from '../../database/models/user/user.model';
import { CardCreatedMail } from '../../notifications/mails/card_created_mail';
import { CardManagementMail } from '../../notifications/mails/card_management_mail';
import { EventEmitterEventsEnum } from '../../services/eventEmitter/eventEmitter.interface';
import { EventEmitterService } from '../../services/eventEmitter/eventEmitter.service';
import { LockerService } from '../../services/locker/locker.service';
import { PushNotificationService } from '../../services/pushNotification/pushNotification.service';
import { CardFundingProcessor } from '../../services/queue/processors/card/card-fund.processor';
import { CardFundingFromNGNProcessor } from '../../services/queue/processors/card/card-funding-from-ngn.processor';
import { MailerService } from '../../services/queue/processors/mailer/mailer.service';
import { KycVerificationRepository } from '../auth/kycVerification/kycVerification.repository';
import { UserRepository } from '../auth/user/user.repository';
import { UserProfileRepository } from '../auth/userProfile/userProfile.repository';
import { BlockchainWalletService } from '../blockchainWallet/blockchainWallet.service';
import { CountryRepository } from '../country/country.repository';
import { DepositAddressRepository } from '../depositAddress/depositAddress.repository';
import { DepositAddressService } from '../depositAddress/depositAddress.service';
import { NgToUsdExchangeEscrowService } from '../exchange/fiat-exchange/ng-to-usd-exchange.service/ng-to-usd-exchange.escrow.service';
import { NgToUsdExchangeService } from '../exchange/fiat-exchange/ng-to-usd-exchange.service/ng-to-usd-exchange.service';
import { FiatWalletService } from '../fiatWallet/fiatWallet.service';
import { IN_APP_NOTIFICATION_TYPE } from '../inAppNotification/inAppNotification.enum';
import { InAppNotificationService } from '../inAppNotification/inAppNotification.service';
import { TransactionRepository } from '../transaction/transaction.repository';
import { CHAIN_IDS, getChainInfoFromId } from '../webhooks/rain/rain-webhook.interface';
import {
  CardNotificationType,
  ICardNotificationConfig,
  ICardNotificationData,
  ICardTransactionFilters,
} from './card.interface';
import { CardFundDto, CardFundRails } from './dto/cardFund.dto';
import { CreateCardDto } from './dto/createCard.dto';
import { CreateCardUserDto } from './dto/createCardUser.dto';
import { CreateDisputeDto } from './dto/createDispute.dto';
import { ExecuteCardFundingFromNGNDto } from './dto/executeCardFundingFromNGN.dto';
import { FreezeCardDto } from './dto/freezeCard.dto';
import { InitiateCardFundingFromNGNDto } from './dto/initiateCardFundingFromNGN.dto';
import { ReissueCardDto } from './dto/reissueCard.dto';
import { UpdateCardLimitDto } from './dto/updateCardLimit.dto';
import { CardRepository } from './repository/card.repository';
import { CardTransactionRepository } from './repository/cardTransaction.repository';
import { CardTransactionDisputeRepository } from './repository/cardTransactionDispute.repository';
import { CardTransactionDisputeEventRepository } from './repository/cardTransactionDisputeEvent.repository';
import { CardUserRepository } from './repository/cardUser.repository';

@Injectable()
export class CardService implements OnModuleInit {
  private readonly logger = new Logger(CardService.name);
  private rainConfig: ReturnType<RainConfigProvider['getConfig']>;
  private cardConfig: ReturnType<CardConfigProvider['getConfig']>;

  @Inject(CardUserRepository)
  private readonly cardUserRepository: CardUserRepository;

  @Inject(KYCAdapter)
  private readonly kycAdapter: KYCAdapter;

  @Inject(CardAdapter)
  private readonly cardAdapter: CardAdapter;

  @Inject(DepositAddressRepository)
  private readonly depositAddressRepository: DepositAddressRepository;

  @Inject(KycVerificationRepository)
  private readonly kycVerificationRepository: KycVerificationRepository;

  @Inject(BlockchainWalletService)
  private readonly blockchainWalletService: BlockchainWalletService;

  @Inject(DepositAddressService)
  private readonly depositAddressService: DepositAddressService;

  @Inject(FiatWalletService)
  private readonly fiatWalletService: FiatWalletService;

  @Inject(CardRepository)
  private readonly cardRepository: CardRepository;

  @Inject(UserProfileRepository)
  private readonly userProfileRepository: UserProfileRepository;

  @Inject(CardTransactionRepository)
  private readonly cardTransactionRepository: CardTransactionRepository;

  @Inject(CardTransactionDisputeRepository)
  private readonly cardTransactionDisputeRepository: CardTransactionDisputeRepository;

  @Inject(CardTransactionDisputeEventRepository)
  private readonly cardTransactionDisputeEventRepository: CardTransactionDisputeEventRepository;

  @Inject(InAppNotificationService)
  private readonly inAppNotificationService: InAppNotificationService;

  @Inject(MailerService)
  private readonly mailerService: MailerService;

  @Inject(CardFundingProcessor)
  private readonly cardFundingProcessor: CardFundingProcessor;

  @Inject(CardFundingFromNGNProcessor)
  private readonly cardFundingFromNGNProcessor: CardFundingFromNGNProcessor;

  @Inject(TransactionRepository)
  private readonly transactionRepository: TransactionRepository;

  @Inject(UserRepository)
  private readonly userRepository: UserRepository;

  @Inject(LockerService)
  private readonly lockerService: LockerService;

  @Inject(EventEmitterService)
  private readonly eventEmitterService: EventEmitterService;

  @Inject(CountryRepository)
  private readonly countryRepository: CountryRepository;

  @Inject(PushNotificationService)
  private readonly pushNotificationService: PushNotificationService;

  @Inject(NgToUsdExchangeService)
  private readonly ngToUsdExchangeService: NgToUsdExchangeService;

  @Inject(NgToUsdExchangeEscrowService)
  private readonly ngToUsdExchangeEscrowService: NgToUsdExchangeEscrowService;

  onModuleInit() {
    this.rainConfig = new RainConfigProvider().getConfig();
    this.cardConfig = new CardConfigProvider().getConfig();
  }

  async create(user: UserModel, createCardUserDto: CreateCardUserDto, ipAddress?: string) {
    this.logger.log(`Creating card user for user: ${user.id}`);

    try {
      const existingCardUser = await this.cardUserRepository.findOne({ user_id: user.id });
      if (existingCardUser) {
        this.logger.error(`Card user already exists for user: ${user.id}`);
        throw new BadRequestException('Card user already exists for this user');
      }

      const kycVerification = (await this.kycVerificationRepository
        .query()
        .where({ user_id: user.id })
        .first()) as KycVerificationModel;

      if (!kycVerification) {
        this.logger.error(`KYC verification not found for user: ${user.id}`);
        throw new NotFoundException('KYC verification not found for user');
      }

      if (!kycVerification.provider_ref) {
        this.logger.error(`KYC has not been completed for user: ${user.id}`);
        throw new BadRequestException('KYC has not been completed');
      }

      const kycDetails = await this.kycAdapter.getKycDetails({
        applicantId: kycVerification.provider_ref,
      });

      this.logger.log(
        `KYC details for applicant ${kycVerification.provider_ref}:`,
        JSON.stringify(kycDetails, null, 2),
      );

      this.logger.log(`Generating share token for applicant: ${kycVerification.provider_ref}`);
      const shareTokenPayload = {
        applicantId: kycVerification.provider_ref,
        forClientId: this.rainConfig.clientId,
        ttlInSecs: 3600,
      };

      const shareTokenResponse = await this.kycAdapter.generateShareToken(shareTokenPayload);
      if (!shareTokenResponse.data?.token) {
        this.logger.error(`Failed to generate KYC share token for user: ${user.id}`);
        throw new BadRequestException('Failed to generate KYC share token');
      }

      const networkForWallet = EnvironmentService.isProduction() ? 'solana' : 'ethereum';

      const blockchainWallet = await this.blockchainWalletService.createCustomWallet(user, {
        network: networkForWallet,
        rail: BLOCKCHAIN_ACCOUNT_RAIL.CARD,
        useDefault: true,
        useBase: true,
      });

      const defaultChainId = this.getDefaultChainId();
      const cardStablecoinUserAddress: CreateCardUserStablecoinAddress = EnvironmentService.isProduction()
        ? { solanaAddress: blockchainWallet.address, chainId: defaultChainId?.toString() }
        : { walletAddress: blockchainWallet.address, chainId: defaultChainId?.toString() };

      this.logger.debug('Default chain id', { defaultChainId });
      this.logger.debug('Card stablecoin user address', { cardStablecoinUserAddress });

      if (!ipAddress) {
        this.logger.error(`IP address is required for card user creation for user: ${user.id}`);
        throw new BadRequestException('IP address is required for card user creation');
      }

      const salary = kycDetails.data.expectedAnnualSalary
        ? Number.parseFloat(kycDetails.data.expectedAnnualSalary)
        : undefined;
      const expectedMonthlySpend = kycDetails.data.expectedMonthlyPaymentsUsd
        ? Number.parseFloat(kycDetails.data.expectedMonthlyPaymentsUsd)
        : undefined;

      this.logger.debug('Salary', { salary });
      this.logger.debug('Expected monthly spend', { expectedMonthlySpend });
      this.logger.debug('IP address', { ipAddress });

      const cardUserRequest: CreateCardUserRequest = {
        proverUserRef: user.id,
        complianceToken: shareTokenResponse.data.token,
        ipAddress: ipAddress,
        email: user.email,
        phoneNumber: user.phone_number,
        occupation: kycDetails.data.mostRecentOccupation || '',
        salary: salary || 0,
        cardUsageReason: kycDetails.data.accountPurpose || '',
        expectedMonthlySpend: expectedMonthlySpend || 0,
        isTermAccepted: true,
        useComplianceDocuments: true,
        cardStablecoinUserAddress,
      };

      this.logger.debug('Card user request', { cardUserRequest });
      this.logger.log(`Creating card user with provider for user: ${user.id}`);

      const cardUserResponse = await this.cardAdapter.createCardUser(cardUserRequest);
      this.logger.debug('Card user response', { cardUserResponse });

      const cardUserData: Omit<ICardUser, 'id' | 'created_at' | 'updated_at' | 'user' | 'country'> = {
        user_id: user.id,
        provider_ref: cardUserResponse.providerRef,
        provider_status: cardUserResponse.status,
        status: this.mapProviderStatusToInternalStatus(cardUserResponse.status),
        provider_application_status_reason: cardUserResponse.applicationStatusReason,
        country_id: user.country_id,
        salary: salary,
        ip_address: ipAddress,
        occupation: kycDetails.data.mostRecentOccupation,
        usage_reason: kycDetails.data.accountPurpose,
        monthly_spend: expectedMonthlySpend,
        wallet_address: blockchainWallet.address,
        address_network_name: blockchainWallet.network,
      };

      const createdCardUser = await this.cardUserRepository.create(cardUserData);
      this.logger.log(
        `Card user created successfully for user: ${user.id}, provider ref: ${cardUserResponse.providerRef}`,
      );
      return createdCardUser;
    } catch (error) {
      this.logger.error(`Failed to create card user for user: ${user.id}`, error);
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Failed to create card user for user: ${user.id}`, error);
      throw new BadRequestException('Failed to create card user');
    }
  }

  getOccupations() {
    return this.cardAdapter.getOccupations();
  }

  getCardLimitFrequencies() {
    return Object.values(CardLimitFrequency).map((frequency) => ({
      value: frequency,
      label: this.formatFrequencyLabel(frequency),
    }));
  }

  async getCardUser(user: UserModel) {
    this.logger.log(`Getting card user for user: ${user.id}`);

    const cardUser = await this.cardUserRepository.findOne({ user_id: user.id });

    if (!cardUser) {
      return null;
    }

    const cardsQuery = this.cardRepository.findSync({ user_id: user.id }).orderBy('created_at', 'desc');
    const cards = await cardsQuery;

    const formattedCards = (cards || [])
      .filter((card) => card.status !== ICardStatus.CANCELED)
      .map((card) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { provider_product_id, provider_product_ref, ...cardWithoutExcludedFields } = card;
        return cardWithoutExcludedFields;
      });

    return {
      id: cardUser.id,
      user_id: cardUser.user_id,
      provider_status: cardUser.provider_status,
      status: cardUser.status,
      balance: cardUser.balance,
      created_at: cardUser.created_at,
      updated_at: cardUser.updated_at,
      cards: formattedCards,
    };
  }

  async getCard(user: UserModel, cardId: string) {
    this.logger.log(`Getting card ${cardId} for user: ${user.id}`);

    const card = await this.cardRepository.findOne({ id: cardId, user_id: user.id });

    if (!card) {
      this.logger.error(`Card ${cardId} not found or does not belong to user: ${user.id}`);
      throw new NotFoundException('Card not found or does not belong to user');
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { provider_product_id, provider_product_ref, ...formattedCard } = card;

    return formattedCard;
  }

  private formatFrequencyLabel(frequency: CardLimitFrequency): string {
    const labels: Record<CardLimitFrequency, string> = {
      [CardLimitFrequency.PER_24_HOUR_PERIOD]: 'Per 24 Hour Period',
      [CardLimitFrequency.PER_7_DAY_PERIOD]: 'Per 7 Day Period',
      [CardLimitFrequency.PER_30_DAY_PERIOD]: 'Per 30 Day Period',
      [CardLimitFrequency.PER_YEAR_PERIOD]: 'Per Year Period',
      [CardLimitFrequency.ALL_TIME]: 'All Time',
      [CardLimitFrequency.PER_AUTHORIZATION]: 'Per Authorization',
    };
    return labels[frequency] || frequency;
  }

  async verifyCardOwnership(user: UserModel, cardId: string) {
    const card = await this.cardRepository.findOne({ id: cardId, user_id: user.id });
    if (!card) {
      this.logger.error(`Card ${cardId} not found or does not belong to user: ${user.id}`);
      throw new NotFoundException('Card not found or does not belong to user');
    }
    return card;
  }

  private mapProviderStatusToInternalStatus(providerStatus: string) {
    const status = providerStatus.toLowerCase();
    switch (status) {
      case 'approved':
        return ICardUserStatus.APPROVED;
      case 'rejected':
      case 'denied':
        return ICardUserStatus.REJECTED;
      case 'active':
        return ICardUserStatus.ACTIVE;
      case 'inactive':
        return ICardUserStatus.INACTIVE;
      case 'suspended':
        return ICardUserStatus.SUSPENDED;
      case 'cancelled':
      case 'canceled':
        return ICardUserStatus.REJECTED;
      default:
        return ICardUserStatus.PENDING;
    }
  }

  async createCard(user: UserModel, dto: CreateCardDto, suppressNotifications: boolean = false) {
    const cardUser = await this.cardUserRepository.findOne({ user_id: user.id });

    if (!cardUser) {
      this.logger.error(`Card user not found for user: ${user.id}`);
      throw new NotFoundException('Card user not found');
    }

    if (cardUser.status !== ICardUserStatus.APPROVED || (cardUser.provider_status || '').toLowerCase() !== 'approved') {
      this.logger.error(
        `Card user is not approved for user: ${user.id}, status: ${cardUser.status}, provider_status: ${cardUser.provider_status}`,
      );
      throw new BadRequestException('Card user is not approved');
    }

    const existingNonCanceledCard = await this.cardRepository.findNonCanceledCardByUserId(user.id);

    if (existingNonCanceledCard) {
      this.logger.error(`User ${user.id} already has a card: ${existingNonCanceledCard.id}`);
      throw new BadRequestException('User already has a card');
    }

    const userProfile = await this.userProfileRepository.findByUserId(user.id);

    if (!userProfile) {
      this.logger.error(`User profile not found for user: ${user.id}`);
      throw new NotFoundException('User profile not found');
    }

    // Check and ensure deposit address exists for Rain provider
    if (this.cardConfig.default_card_provider === CardProvider.RAIN) {
      await this.ensureRainDepositAddress(user, cardUser.provider_ref);
    }

    // Look up country code from country_id
    let billingCountryCode = user.country?.code || '';

    if (!billingCountryCode && user.country_id) {
      const countryRecord = await this.countryRepository.findById(user.country_id);
      if (countryRecord?.code) {
        billingCountryCode = countryRecord.code;
        this.logger.log(`Found country code "${billingCountryCode}" from country_id "${user.country_id}"`);
      }
    }

    const createReq: CreateCardRequest = {
      providerUserRef: cardUser.provider_ref,
      type: dto.type,
      limit: {
        amount: CurrencyUtility.formatCurrencyAmountToSmallestUnit(DefaultCardLimit, 'USD'),
        frequency: CardLimitFrequency.PER_24_HOUR_PERIOD,
      },
      firstName: user.first_name,
      lastName: user.last_name,
      billing: {
        line1: userProfile.address_line1,
        line2: userProfile.address_line2,
        city: userProfile.city,
        region: userProfile.state_or_province,
        postalCode: userProfile.postal_code,
        countryCode: billingCountryCode,
        country: user.country?.name || '',
      },
      status: CardStatus.ACTIVE,
      shipping:
        dto.type === CardType.PHYSICAL
          ? {
              line1: dto.shipping_line1,
              line2: dto.shipping_line2 || '',
              city: dto.shipping_city,
              region: dto.shipping_region,
              postalCode: dto.shipping_postal_code,
              countryCode: dto.shipping_country_code,
              country: user.country?.name || dto.shipping_country_code,
              phoneNumber: user.phone_number,
              method: ShippingMethod.STANDARD,
            }
          : undefined,
    };

    this.logger.debug(`Creating card with provider`, { createReq });

    const providerCard = await this.cardAdapter.createCard(createReq);
    this.logger.debug(`Card created with provider`, { providerCard });

    const card = await this.cardRepository.create({
      user_id: user.id,
      card_user_id: cardUser.id,
      provider_ref: providerCard.cardId,
      status: providerCard.status,
      limit: 5000, // Default limit amount
      limit_frequency: CardLimitFrequency.PER_24_HOUR_PERIOD,
      display_name: providerCard.displayName,
      provider_product_id: undefined,
      provider_product_ref: undefined,
      art_id: undefined,
      last_four_digits: providerCard.lastFourDigits,
      address_line_1: createReq.billing.line1,
      address_line_2: createReq.billing.line2,
      city: createReq.billing.city,
      region: createReq.billing.region,
      postal_code: createReq.billing.postalCode,
      country_id: user.country_id,
      is_freezed: false,
      expiration_month: providerCard.expiryMonth?.toString?.() ?? String(providerCard.expiryMonth ?? ''),
      expiration_year: providerCard.expiryYear?.toString?.() ?? String(providerCard.expiryYear ?? ''),
      issuance_fee_status: dto.type === CardType.VIRTUAL ? IIssuanceFeeStatus.PENDING : undefined,
    } as any);

    if (!suppressNotifications) {
      try {
        await this.sendCardNotification(
          { inApp: true, email: true, push: true },
          {
            userId: user.id,
            notificationType: CardNotificationType.CARD_CREATED,
            metadata: {
              cardId: card.id,
              cardType: dto.type,
              lastFourDigits: providerCard.lastFourDigits,
            },
            emailMail: new CardCreatedMail(user, card.id, dto.type, providerCard.lastFourDigits),
          },
        );
      } catch (error) {
        this.logger.error(`Failed to send card created notification/email: ${error.message}`, error);
      }
    }

    await this.transferBalanceFromCanceledCard(user, card.id); // Return value not needed here

    return card;
  }

  /**
   * Ensures a Rain deposit address exists for the user
   * Checks DB first, then provider, and creates if needed
   * Allows multiple deposit addresses per user for different chains
   */
  private async ensureRainDepositAddress(user: UserModel, providerUserRef: string): Promise<void> {
    this.logger.log(`Ensuring Rain deposit address for user ${user.id}`);

    const defaultChainId = this.getDefaultChainId();

    // Check if deposit address already exists for default chain
    if (defaultChainId) {
      const hasExisting = await this.checkExistingDefaultDepositAddress(user, defaultChainId);
      if (hasExisting) return;
    }

    // Check if contract exists from provider
    const contracts = await this.fetchUserContracts(providerUserRef);

    // If contracts exist, sync deposit addresses
    if (contracts.length > 0) {
      await this.syncContractDepositAddresses(user, contracts);
      return;
    }

    // If no contract exists, create one
    await this.createNewContract(providerUserRef, defaultChainId);
  }

  private getDefaultChainId(): number | undefined {
    const defaultNetwork = StableCoinsService.getDefaultNetwork();
    const defaultChainName = this.mapNetworkToChainName(defaultNetwork) as keyof typeof CHAIN_IDS;
    const environment = EnvironmentService.isProduction() ? 'prod' : 'dev';
    const chainId = CHAIN_IDS[defaultChainName]?.[environment];

    if (!chainId) {
      this.logger.warn(
        `Could not determine default chain ID for network ${defaultNetwork} (chain: ${defaultChainName}, env: ${environment})`,
      );
    }

    return chainId;
  }

  private async checkExistingDefaultDepositAddress(user: UserModel, defaultChainId: number): Promise<boolean> {
    const defaultChainInfo = getChainInfoFromId(defaultChainId);
    if (!defaultChainInfo) return false;

    const existingAddress = await this.depositAddressRepository.findOne({
      user_id: user.id,
      provider: 'rain',
      asset: defaultChainInfo.chainName,
    });

    if (existingAddress) {
      this.logger.log(
        `User ${user.id} already has Rain deposit address for default chain ${defaultChainInfo.chainName}: ${existingAddress.address}`,
      );
      return true;
    }

    return false;
  }

  private async fetchUserContracts(providerUserRef: string): Promise<RainContractResponse[]> {
    try {
      const contracts = await this.cardAdapter.getUserContracts(providerUserRef);
      this.logger.log(`Found ${contracts.length} contract(s) for user ${providerUserRef}`);
      return contracts;
    } catch (error) {
      this.logger.warn(`Failed to fetch contracts from provider for user ${providerUserRef}: ${error.message}`);
      return [];
    }
  }

  private async syncContractDepositAddresses(user: UserModel, contracts: RainContractResponse[]): Promise<void> {
    for (const contract of contracts) {
      const chainInfo = getChainInfoFromId(contract.chainId);
      if (!chainInfo || !contract.depositAddress) continue;

      const asset = chainInfo.chainName;
      const existingAddress = await this.depositAddressRepository.findOne({
        user_id: user.id,
        provider: 'rain',
        asset,
      });

      if (existingAddress) {
        this.logger.log(
          `Deposit address already exists for user ${user.id} on chain ${asset}: ${existingAddress.address}`,
        );
        continue;
      }

      this.logger.log(`Creating deposit address for user ${user.id} on chain ${asset}: ${contract.depositAddress}`);
      await this.depositAddressRepository.create({
        user_id: user.id,
        provider: 'rain',
        asset,
        address: contract.depositAddress,
      });
      this.logger.log(`Created deposit address record in DB for user ${user.id} on chain ${asset}`);
    }
  }

  private async createNewContract(providerUserRef: string, defaultChainId: number | undefined): Promise<void> {
    this.logger.log(`No contract found, creating new contract for user ${providerUserRef}`);

    if (!defaultChainId) {
      this.logger.error(`Cannot create contract: default chain ID not determined`);
      return;
    }

    try {
      const contract = await this.cardAdapter.createUserContract(providerUserRef, defaultChainId);
      this.logger.log(`Contract created: ${contract}`);
      this.logger.log(
        `Contract creation initiated for user ${providerUserRef}, webhook will handle deposit address creation`,
      );
    } catch (error) {
      this.logger.error(`Failed to create contract for user ${providerUserRef}: ${error.message}`);
    }
  }

  /**
   * Maps OneDosh network enum to chain name for CHAIN_IDS lookup
   */
  private mapNetworkToChainName(network: string): string {
    const mapping: Record<string, string> = {
      ETH: 'ethereum',
      BASECHAIN: 'base',
      SOL: 'solana',
      ERC20: 'ethereum', // ERC20 tokens use Ethereum chain
    };

    return mapping[network] || 'ethereum';
  }

  async fundCard(user: UserModel, dto: CardFundDto & { card_id: string }) {
    this.logger.log(`Funding card ${dto.card_id} with ${dto.amount} via ${dto.rail}`);

    const { card, cardUser } = await this.validateCardAndCardUserForFunding(user, dto.card_id);

    await this.validateMinimumFundingAmount(card.id, dto.amount, 'First card top-up must be at least $5.00');

    const defaultChainId = this.getDefaultChainId();
    this.logger.log(`Default chain ID: ${defaultChainId}`);
    if (!defaultChainId) {
      this.logger.error(`Default chain not configured for card funding for user: ${user.id}`);
      throw new BadRequestException('Default chain not configured for card funding');
    }

    const chainInfo = getChainInfoFromId(defaultChainId);
    this.logger.log(`Chain info: ${chainInfo}`);
    if (!chainInfo) {
      this.logger.error(`Invalid default chain configuration for user: ${user.id}, chainId: ${defaultChainId}`);
      throw new BadRequestException('Invalid default chain configuration');
    }

    // Validate deposit address exists (required for card funding, but address not used in this method)
    await this.getRainDepositAddressForCardFunding(user.id, chainInfo);

    const feeType = dto.rail === CardFundRails.FIAT ? CardFeeType.FIAT_TOP_UP : CardFeeType.STABLECOIN_TOP_UP;

    // Calculate fee for the top-up amount (fee is in cents, minimum 1 cent enforced)
    const feeCalculation = await this.getCardTransactionFee(dto.amount, feeType);

    // Ensure fee is at least 1 cent (100 in smallest unit for wallets)
    // feeCalculation.fee is already in cents with minimum 1 cent enforced
    const feeInCents = Math.max(1, feeCalculation.fee);
    this.logger.log(`[FUND_CARD] Fee in cents (after min check): ${feeInCents} cents`);

    // Convert fee from cents to USD for total calculation
    const feeInUSD = CurrencyUtility.formatCurrencyAmountToMainUnit(feeInCents, 'USD');

    // Total amount to debit from user = original amount + fee
    const totalAmountToDebit = add(dto.amount, feeInUSD);
    this.logger.log(
      `[FUND_CARD] Total amount to debit from user: ${totalAmountToDebit} USD (original: ${dto.amount} USD + fee: ${feeInUSD} USD)`,
    );

    // Convert amount to cents to avoid conflicts
    // Assume card balance is already in cents (as it's stored in the database)
    // If balance is null/undefined, treat as 0 cents
    const amountInCents = CurrencyUtility.formatCurrencyAmountToSmallestUnit(dto.amount, 'USD');
    const balanceBeforeInCents = Number(card.balance || 0);
    const balanceAfterInCents = add(balanceBeforeInCents, amountInCents);

    const cardTransaction = await this.cardTransactionRepository.create({
      user_id: user.id,
      card_user_id: cardUser.id,
      card_id: card.id,
      amount: amountInCents,
      currency: 'USD',
      merchant_name: 'Card Funding',
      status: CardTransactionStatus.PENDING,
      transaction_type: CardTransactionType.DEPOSIT,
      type: CardTransactionDrCr.CREDIT,
      balance_before: balanceBeforeInCents,
      balance_after: balanceAfterInCents,
      description: `Card Funding from USD wallet`,
      fee: feeInCents,
    });

    this.logger.log(
      `[FUND_CARD] Card transaction created: ${cardTransaction.id} | Amount: ${dto.amount} USD (${amountInCents} cents) | Fee: ${feeInUSD} USD (${feeInCents} cents) | Total to debit: ${totalAmountToDebit} USD | Balance before: ${balanceBeforeInCents} cents | Balance after: ${balanceAfterInCents} cents`,
    );

    // Enqueue the funding job to be processed asynchronously
    try {
      const job = await this.cardFundingProcessor.queueCardFunding({
        cardTransactionId: cardTransaction.id,
        userId: user.id,
        cardId: dto.card_id,
        amount: dto.amount,
        fee: feeInUSD,
        rail: dto.rail,
        cardLastFourDigits: card.last_four_digits,
      });

      this.logger.log(`Card funding job queued: ${job.id} for transaction ${cardTransaction.id}`);

      this.eventEmitterService.emit(EventEmitterEventsEnum.SERVICE_STATUS_SUCCESS, {
        serviceKey: PlatformServiceKey.CARD_SERVICE,
      });

      return {
        transaction_id: cardTransaction.id,
        card_id: dto.card_id,
        amount: dto.amount,
        fee: feeInUSD,
        total_amount: totalAmountToDebit,
        rail: dto.rail,
        status: 'pending',
        message: 'Funding initiated successfully',
        job_id: job.id,
      };
    } catch (error) {
      this.logger.error(`Failed to queue card funding: ${error.message}`, error);

      this.eventEmitterService.emit(EventEmitterEventsEnum.SERVICE_STATUS_FAILURE, {
        serviceKey: PlatformServiceKey.CARD_SERVICE,
        reason: error.message,
      });

      // Update transaction status to failed
      await this.cardTransactionRepository.update(
        { id: cardTransaction.id },
        { status: CardTransactionStatus.DECLINED, declined_reason: error.message },
      );

      this.logger.error(`Failed to initiate card funding for user: ${user.id}, card: ${dto.card_id}`, error);
      throw new BadRequestException(`Failed to initiate card funding: ${error.message}`);
    }
  }

  async getCardDetails(user: UserModel, cardId: string) {
    this.logger.log(`Getting card details for card ${cardId} for user ${user.id}`);

    const card = await this.verifyCardOwnership(user, cardId);

    if (!card.provider_ref) {
      this.logger.error(`Card provider reference not found for card: ${cardId}, user: ${user.id}`);
      throw new BadRequestException('Card provider reference not found');
    }

    try {
      const cardDetails = await this.cardAdapter.getDecryptedCardSecrets(card.provider_ref);
      this.logger.log(`Card details retrieved successfully for card ${cardId}`);
      return cardDetails;
    } catch (error) {
      this.logger.error(`Failed to get card details for card ${cardId}: ${error.message}`, error);
      throw new BadRequestException(`Failed to get card details: ${error.message}`);
    }
  }

  async freezeOrUnfreezeCard(user: UserModel, cardId: string, dto: FreezeCardDto) {
    const action = dto.freeze ? 'freeze' : 'unfreeze';
    const actionPastTense = dto.freeze ? 'frozen' : 'unfrozen';
    this.logger.log(`${dto.freeze ? 'Freezing' : 'Unfreezing'} card ${cardId} for user ${user.id}`);

    const card = await this.verifyCardOwnership(user, cardId);
    this.validateFreezeUnfreezeAction(card, dto.freeze);

    const providerStatus = dto.freeze ? CardStatus.LOCKED : CardStatus.ACTIVE;
    const newStatus = dto.freeze ? ICardStatus.INACTIVE : ICardStatus.ACTIVE;

    try {
      const updatedCard = await this.cardAdapter.updateCard(card.provider_ref, { status: providerStatus });
      this.logger.log(`Card ${cardId} ${actionPastTense} successfully with provider`);

      await this.cardRepository.update({ id: cardId }, { is_freezed: dto.freeze, status: newStatus });
      this.logger.log(`Card ${cardId} ${actionPastTense} successfully in database`);

      const updatedCardRecord = { ...card, status: newStatus, is_freezed: dto.freeze };
      await this.sendCardStatusUpdateNotification(card.user_id, updatedCardRecord as ICard, newStatus);

      return { card_id: cardId, is_freezed: dto.freeze, status: updatedCard.status };
    } catch (error) {
      this.logger.error(`Failed to ${action} card ${cardId} for user: ${user.id}`, error);
      throw new BadRequestException(`Failed to ${action} card: ${error.message}`);
    }
  }

  async adminBlockOrUnlockCard(cardId: string, dto: { block: boolean }) {
    const action = dto.block ? 'block' : 'unlock';
    const actionPastTense = dto.block ? 'blocked' : 'unlocked';
    this.logger.log(`Admin ${action}ing card ${cardId}`);

    const card = await this.cardRepository.findOne({ id: cardId });
    if (!card) {
      this.logger.error(`Card not found: ${cardId}`);
      throw new NotFoundException('Card not found');
    }

    if (!card.provider_ref) {
      this.logger.error(`Card provider reference not found for card: ${cardId}`);
      throw new BadRequestException('Card provider reference not found');
    }

    if (card.status === ICardStatus.CANCELED) {
      this.logger.error(`Cannot block or unlock a canceled card: ${cardId}, status: ${card.status}`);
      throw new BadRequestException('Cannot block or unlock a canceled card');
    }

    const providerStatus = dto.block ? CardStatus.LOCKED : CardStatus.ACTIVE;
    const newStatus = dto.block ? ICardStatus.BLOCKED : ICardStatus.ACTIVE;

    try {
      const updatedCard = await this.cardAdapter.updateCard(card.provider_ref, { status: providerStatus });
      this.logger.log(`Card ${cardId} ${actionPastTense} successfully with provider`);

      await this.cardRepository.update({ id: cardId }, { is_freezed: dto.block, status: newStatus });
      this.logger.log(`Card ${cardId} ${actionPastTense} successfully in database`);

      const updatedCardRecord = { ...card, status: newStatus, is_freezed: dto.block };
      await this.sendCardStatusUpdateNotification(card.user_id, updatedCardRecord as ICard, newStatus);

      return { card_id: cardId, is_freezed: dto.block, status: updatedCard.status };
    } catch (error) {
      this.logger.error(`Failed to ${action} card ${cardId}`, error);
      throw new BadRequestException(`Failed to ${action} card: ${error.message}`);
    }
  }

  private async hasPendingTransactions(cardId: string): Promise<boolean> {
    const pendingTransactions = await this.cardTransactionRepository.findOne({
      card_id: cardId,
      status: CardTransactionStatus.PENDING,
    });
    return !!pendingTransactions;
  }

  async cancelCard(user: UserModel, cardId: string, suppressNotifications: boolean = false) {
    this.logger.log(`Cancelling card ${cardId} for user ${user.id}`);

    const card = await this.verifyCardOwnership(user, cardId);

    if (!card.provider_ref) {
      this.logger.error(`Card provider reference not found for card: ${cardId}, user: ${user.id}`);
      throw new BadRequestException('Card provider reference not found');
    }

    if (card.status === ICardStatus.CANCELED) {
      this.logger.error(`Card is already canceled: ${cardId}, user: ${user.id}`);
      throw new BadRequestException('Card is already canceled');
    }

    const hasPending = await this.hasPendingTransactions(cardId);
    if (hasPending) {
      this.logger.error(`Cannot cancel card with pending transactions: ${cardId}, user: ${user.id}`);
      throw new BadRequestException('Cannot cancel card with pending transactions');
    }

    try {
      const updatedCard = await this.cardAdapter.updateCard(card.provider_ref, { status: CardStatus.CANCELED });
      this.logger.log(`Card ${cardId} canceled successfully with provider (sent CANCELED status)`);

      await this.cardRepository.update(
        { id: cardId },
        {
          status: ICardStatus.CANCELED,
          is_freezed: true,
        },
      );
      this.logger.log(`Card ${cardId} canceled successfully in database`);

      if (!suppressNotifications) {
        const updatedCardRecord = {
          ...card,
          status: ICardStatus.CANCELED,
          is_freezed: true,
        };
        await this.sendCardStatusUpdateNotification(card.user_id, updatedCardRecord as ICard, ICardStatus.CANCELED);
      }

      return { card_id: cardId, status: updatedCard.status };
    } catch (error) {
      this.logger.error(`Failed to cancel card ${cardId} for user: ${user.id}`, error);
      throw new BadRequestException(`Failed to cancel card: ${error.message}`);
    }
  }

  async reissueCard(user: UserModel, cardId: string, dto: ReissueCardDto) {
    this.logger.log(`Re-issuing card ${cardId} for user ${user.id}`);

    const existingCard = await this.verifyCardOwnership(user, cardId);

    if (existingCard.status === ICardStatus.CANCELED) {
      this.logger.error(`Cannot re-issue a canceled card: ${cardId}, user: ${user.id}`);
      throw new BadRequestException('Cannot re-issue a canceled card');
    }

    if (existingCard.status !== ICardStatus.ACTIVE) {
      this.logger.error(`Card must be active to re-issue: ${cardId}, user: ${user.id}, status: ${existingCard.status}`);
      throw new BadRequestException('Card must be active to re-issue');
    }

    const hasPending = await this.hasPendingTransactions(cardId);
    if (hasPending) {
      this.logger.error(`Cannot re-issue card with pending transactions: ${cardId}, user: ${user.id}`);
      throw new BadRequestException('Cannot re-issue card with pending transactions');
    }

    this.logger.log(`Canceling existing card ${existingCard.id} before re-issue`);

    await this.cancelCard(user, existingCard.id, true);

    this.logger.log(`Creating new card after canceling card ${existingCard.id}`);

    const cardType = dto.type || CardType.VIRTUAL;
    const createCardDto: CreateCardDto = {
      type: cardType,
      shipping_line1: dto.shipping_line1,
      shipping_line2: dto.shipping_line2,
      shipping_city: dto.shipping_city,
      shipping_region: dto.shipping_region,
      shipping_postal_code: dto.shipping_postal_code,
      shipping_country_code: dto.shipping_country_code,
    };

    const newCard = await this.createCard(user, createCardDto, true);

    const transferTransaction = await this.transferBalanceFromCanceledCard(user, newCard.id, existingCard.id);

    this.logger.log(`Card re-issued successfully. Old card: ${existingCard.id}, New card: ${newCard.id}`);

    // Check if issuance fee should be charged for reissued card
    if (cardType === CardType.VIRTUAL) {
      const updatedNewCard = await this.cardRepository.findOne({ id: newCard.id });
      if (updatedNewCard) {
        const cardBalance = Number(updatedNewCard.balance || 0);
        const oneDollarInCents = CurrencyUtility.formatCurrencyAmountToSmallestUnit(1, 'USD');

        if (cardBalance <= oneDollarInCents) {
          this.logger.log(
            `Card balance (${cardBalance} cents) is <= $1, charging issuance fee for reissued card ${newCard.id}`,
          );

          // Set issuance_fee_status to PENDING
          await this.cardRepository.update({ id: newCard.id }, {
            issuance_fee_status: IIssuanceFeeStatus.PENDING,
          } as Partial<ICard>);

          // Get card user
          const cardUser = await this.cardUserRepository.findOne({ user_id: user.id });
          if (cardUser && transferTransaction) {
            // Charge issuance fee using the transfer transaction
            try {
              await this.chargeIssuanceFee(updatedNewCard, cardUser, transferTransaction);
            } catch (error) {
              this.logger.error(
                `Failed to charge issuance fee for reissued card ${newCard.id}: ${error.message}`,
                error,
              );
            }
          }
        }
      }
    }

    try {
      const userRecord = await this.userRepository.findActiveById(user.id);
      if (userRecord) {
        await this.sendCardNotification(
          { inApp: true, email: true, push: true },
          {
            userId: user.id,
            notificationType: CardNotificationType.CARD_REISSUED,
            metadata: {
              oldCardId: existingCard.id,
              newCardId: newCard.id,
              cardType: cardType,
              lastFourDigits: newCard.last_four_digits,
            },
            emailMail: new CardManagementMail(userRecord, 'reissue', newCard.id),
          },
        );
      }
    } catch (error) {
      this.logger.error(`Failed to send card reissued notification/email: ${error.message}`, error);
    }

    return {
      oldCardId: existingCard.id,
      newCard: newCard,
    };
  }

  private async transferBalanceFromCanceledCard(
    user: UserModel,
    newCardId: string,
    oldCardId?: string,
  ): Promise<ICardTransaction | null> {
    try {
      let oldCard: ICard | undefined;

      if (oldCardId) {
        oldCard = await this.cardRepository.findOne({ id: oldCardId, user_id: user.id });

        if (!oldCard) {
          this.logger.warn(`Old card ${oldCardId} not found for balance transfer`);
          return null;
        }
      } else {
        oldCard = await this.cardRepository.findLastCanceledCardWithBalance(user.id);

        if (!oldCard) {
          return null;
        }
      }

      const oldBalance = Number(oldCard.balance || 0);

      if (oldBalance === 0) {
        this.logger.log(`No balance to transfer from card ${oldCard.id} (balance: ${oldBalance})`);
        return null;
      }

      const newCard = await this.cardRepository.findOne({ id: newCardId, user_id: user.id });

      if (!newCard) {
        this.logger.warn(`New card ${newCardId} not found for balance transfer`);
        return null;
      }

      const cardUser = await this.cardUserRepository.findOne({ user_id: user.id });

      if (!cardUser) {
        this.logger.warn(`Card user not found for user ${user.id}`);
        return null;
      }

      const newBalanceBefore = Number(newCard.balance || 0);
      const newBalanceAfter = add(newBalanceBefore, oldBalance);

      let transferTransaction: ICardTransaction | null = null;

      await this.cardRepository.transaction(async (trx) => {
        await this.cardRepository.update({ id: oldCard.id }, { balance: 0 } as Partial<ICard>, { trx });

        await this.cardRepository.update({ id: newCardId }, { balance: newBalanceAfter } as Partial<ICard>, {
          trx,
        });

        transferTransaction = await this.cardTransactionRepository.create(
          {
            user_id: user.id,
            card_user_id: cardUser.id,
            card_id: newCardId,
            amount: oldBalance,
            currency: 'USD',
            merchant_name: 'Balance Transfer',
            status: CardTransactionStatus.SUCCESSFUL,
            transaction_type: CardTransactionType.DEPOSIT,
            type: CardTransactionDrCr.CREDIT,
            balance_before: newBalanceBefore,
            balance_after: newBalanceAfter,
            description: `Balance transferred from previous card ending in ${oldCard.last_four_digits || oldCard.id.slice(-4)} during card reissuance`,
            fee: 0,
          },
          trx,
        );

        await this.cardTransactionRepository.create(
          {
            user_id: user.id,
            card_user_id: cardUser.id,
            card_id: oldCard.id,
            amount: oldBalance,
            currency: 'USD',
            merchant_name: 'Balance Transfer',
            status: CardTransactionStatus.SUCCESSFUL,
            transaction_type: CardTransactionType.TRANSFER,
            type: CardTransactionDrCr.DEBIT,
            balance_before: oldBalance,
            balance_after: 0,
            description: `Balance transferred to new card ending in ${newCard.last_four_digits || newCardId.slice(-4)} during card reissuance`,
            fee: 0,
          },
          trx,
        );
      });

      this.logger.log(
        `Transferred balance ${oldBalance} cents from canceled card ${oldCard.id} to new card ${newCardId}`,
      );

      return transferTransaction;
    } catch (error) {
      this.logger.error(`Failed to transfer balance from canceled card to ${newCardId}: ${error.message}`, error);
      return null;
    }
  }

  private validateFreezeUnfreezeAction(card: ICard, freeze: boolean): void {
    if (!card.provider_ref) {
      this.logger.error(`Card provider reference not found for card: ${card.id}`);
      throw new BadRequestException('Card provider reference not found');
    }

    if (!freeze && (card.status === ICardStatus.BLOCKED || card.status === ICardStatus.CANCELED)) {
      this.logger.error(`Card is blocked and cannot be unfrozen: ${card.id}, status: ${card.status}`);
      throw new BadRequestException('Card is blocked and cannot be unfrozen. Please contact support.');
    }

    if (card.is_freezed === freeze) {
      this.logger.error(`Card is already ${freeze ? 'frozen' : 'unfrozen'}: ${card.id}`);
      throw new BadRequestException(`Card is already ${freeze ? 'frozen' : 'unfrozen'}`);
    }
  }

  private isAtmTransaction(cardTransaction: ICardTransaction): boolean {
    return (
      /atm/i.test(cardTransaction.merchant_name || '') ||
      /atm/i.test(cardTransaction.merchant_category || '') ||
      /atm/i.test(cardTransaction.description || '') ||
      ['6010', '6011', '6012'].includes((cardTransaction.merchant_category_code || '').toString())
    );
  }

  /**
   * Determines notification content based on notification type
   */
  private getNotificationContent(
    notificationType: CardNotificationType,
    metadata?: Record<string, any>,
  ): { inAppNotificationType: IN_APP_NOTIFICATION_TYPE; title: string; message: string } | null {
    switch (notificationType) {
      case CardNotificationType.CARD_CREATED:
        return {
          inAppNotificationType: IN_APP_NOTIFICATION_TYPE.CARD_CREATED,
          title: `${metadata?.cardType === CardType.VIRTUAL ? 'Virtual' : 'Physical'} Card Created`,
          message: `Your OneDosh ${metadata?.cardType === CardType.VIRTUAL ? 'virtual' : 'physical'} card is ready! Tap to view your card details and start spending!.`,
        };

      case CardNotificationType.CARD_FROZEN:
        return {
          inAppNotificationType: IN_APP_NOTIFICATION_TYPE.CARD_FROZEN,
          title: 'Card frozen.',
          message: 'No transactions can be made until you unfreeze it.',
        };

      case CardNotificationType.CARD_UNFROZEN:
        return {
          inAppNotificationType: IN_APP_NOTIFICATION_TYPE.CARD_UNFROZEN,
          title: 'Card Unfrozen',
          message: "Card active. You're ready to spend again!",
        };

      case CardNotificationType.CARD_BLOCKED: {
        const title = 'Card Blocked';
        let message: string;
        if (metadata?.reason === 'insufficient_funds_consecutive_declines') {
          const declineCount = metadata?.declineCount || MAX_INSUFFICIENT_FUNDS_DECLINES;
          message = `Your card has been blocked due to ${declineCount} consecutive declined transactions for insufficient funds. Please fund your card to continue using it.`;
        } else {
          message =
            'Your card has been blocked and can no longer be used for transactions. Please contact support for assistance.';
        }
        return {
          inAppNotificationType: IN_APP_NOTIFICATION_TYPE.CARD_BLOCKED,
          title,
          message,
        };
      }

      case CardNotificationType.CARD_REISSUED: {
        const cardType = metadata?.cardType === CardType.VIRTUAL ? 'virtual' : 'physical';
        return {
          inAppNotificationType: IN_APP_NOTIFICATION_TYPE.CARD_CREATED,
          title: 'Card Reissued Successfully',
          message: `Your OneDosh ${cardType} card has been successfully reissued. Your balance has been transferred to the new card.`,
        };
      }

      case CardNotificationType.CARD_ISSUANCE_FEE: {
        const formattedAmount =
          metadata?.amount?.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }) || '0.00';
        return {
          inAppNotificationType: IN_APP_NOTIFICATION_TYPE.CARD_DEBITED,
          title: 'Card Issuance Fee',
          message: `A card issuance fee of $${formattedAmount} has been charged to your card.`,
        };
      }

      case CardNotificationType.CARD_DEBITED: {
        const formattedAmount =
          metadata?.amount?.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }) || '0.00';
        const formattedBalance =
          metadata?.newBalance?.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }) || '0.00';
        const merchantName = metadata?.merchantName || 'Merchant';
        return {
          inAppNotificationType: IN_APP_NOTIFICATION_TYPE.CARD_DEBITED,
          title: 'Payment Successful',
          message: `$${formattedAmount} paid at ${merchantName}. Balance: $${formattedBalance}`,
        };
      }

      case CardNotificationType.CARD_FUNDED: {
        const formattedAmount =
          metadata?.amount?.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }) || '0.00';
        const currency = metadata?.currency || 'USD';
        return {
          inAppNotificationType: IN_APP_NOTIFICATION_TYPE.CARD_FUNDED,
          title: 'Card Funded Successfully',
          message: `Your card has been successfully funded with $${formattedAmount} ${currency.toUpperCase()}.`,
        };
      }

      case CardNotificationType.INSUFFICIENT_FUNDS_FEE: {
        const formattedAmount =
          metadata?.feeAmount?.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }) || '0.00';
        const declineCount = metadata?.declineCount || 0;
        const warningMessage =
          declineCount >= MAX_INSUFFICIENT_FUNDS_DECLINES - 1
            ? ` Warning: One more decline will result in your card being blocked.`
            : '';
        return {
          inAppNotificationType: IN_APP_NOTIFICATION_TYPE.CARD_DEBITED,
          title: 'Insufficient Funds Fee',
          message: `A fee of $${formattedAmount} has been charged due to a declined transaction for insufficient funds.${warningMessage}`,
        };
      }

      case CardNotificationType.TRANSACTION_DECLINED_INSUFFICIENT_FUNDS: {
        return {
          inAppNotificationType: IN_APP_NOTIFICATION_TYPE.TRANSACTION_FAILED,
          title: 'Payment Declined',
          message: 'Payment declined - Insufficient balance. Top up to continue using your card.',
        };
      }

      case CardNotificationType.DISPUTE_UPDATED: {
        const status = metadata?.status || 'updated';
        const statusMessages: Record<string, string> = {
          pending: 'Your dispute is being reviewed.',
          inReview: 'Your dispute is under review.',
          accepted: 'Your dispute has been accepted and resolved.',
          rejected: 'Your dispute has been rejected.',
          canceled: 'Your dispute has been canceled.',
        };
        const message = statusMessages[status] || 'Your dispute status has been updated.';
        return {
          inAppNotificationType: IN_APP_NOTIFICATION_TYPE.DISPUTE_UPDATED,
          title: 'Dispute Status Updated',
          message,
        };
      }

      case CardNotificationType.TOKEN_WALLET_ADDED: {
        const tokenWallets = metadata?.tokenWallets || [];
        const walletNames = tokenWallets.map((wallet: string) => {
          if (wallet.toLowerCase().includes('apple')) return 'Apple Pay';
          if (wallet.toLowerCase().includes('google')) return 'Google Pay';
          return wallet;
        });
        const walletName = walletNames.length > 0 ? walletNames.join(' and ') : 'digital wallet';
        return {
          inAppNotificationType: IN_APP_NOTIFICATION_TYPE.INFO,
          title: 'Card Added to Digital Wallet',
          message: `Your card has been successfully added to ${walletName}. You can now use it for contactless payments.`,
        };
      }

      default:
        return null;
    }
  }

  /**
   * Unified method to send card notifications (in-app, email, push)
   */
  async sendCardNotification(config: ICardNotificationConfig, data: ICardNotificationData): Promise<void> {
    try {
      const { userId, notificationType, metadata, emailMail } = data;

      const notificationContent = this.getNotificationContent(notificationType, metadata);
      if (!notificationContent) {
        this.logger.warn(`Unknown card notification type: ${notificationType}`);
        return;
      }

      const { inAppNotificationType, title, message } = notificationContent;

      if (config.inApp) {
        await this.inAppNotificationService.createNotification({
          user_id: userId,
          type: inAppNotificationType,
          title,
          message,
          metadata,
        });
      }

      if (config.email && emailMail) {
        await this.mailerService.send(emailMail);
      }

      if (config.push) {
        const userProfile = await this.userProfileRepository.findByUserId(userId);
        console.log('[card.service.ts] sending push notification to user', userId);
        if (userProfile?.notification_token) {
          await this.pushNotificationService.sendPushNotification([userProfile.notification_token], {
            title,
            body: message,
          });
        }
      }

      if (data.balanceChangeEvent) {
        this.eventEmitterService.emit(EventEmitterEventsEnum.WALLET_BALANCE_CHANGED, {
          userId,
          ...data.balanceChangeEvent,
          timestamp: DateTime.now().toJSDate(),
        });
      }
    } catch (error) {
      this.logger.error(`Failed to send card notification: ${error.message}`, error);
    }
  }

  /**
   * Sends notification and email when card status is updated by user actions
   */
  private async sendCardStatusUpdateNotification(
    userId: string,
    card: ICard,
    currentStatus: ICardStatus,
  ): Promise<void> {
    try {
      const user = await this.userRepository.findActiveById(userId);
      if (!user) {
        this.logger.warn(`User not found for card status update notification: ${userId}`);
        return;
      }

      let notificationType: CardNotificationType;
      let action: 'freeze' | 'unfreeze' | 'blocked';

      switch (currentStatus) {
        case ICardStatus.INACTIVE:
          notificationType = CardNotificationType.CARD_FROZEN;
          action = 'freeze';
          break;
        case ICardStatus.ACTIVE:
          notificationType = CardNotificationType.CARD_UNFROZEN;
          action = 'unfreeze';
          break;
        case ICardStatus.BLOCKED:
        case ICardStatus.CANCELED:
          notificationType = CardNotificationType.CARD_BLOCKED;
          action = 'blocked';
          break;
        default:
          return;
      }

      await this.sendCardNotification(
        { inApp: true, email: true, push: true },
        {
          userId,
          notificationType,
          metadata: {
            cardId: card.id,
            status: currentStatus,
          },
          emailMail: new CardManagementMail(user, action, card.id),
        },
      );
    } catch (error) {
      this.logger.error(`Failed to send card status update notification/email: ${error.message}`, error);
    }
  }

  async updateCardLimit(user: UserModel, cardId: string, dto: UpdateCardLimitDto) {
    this.logger.log(`Updating card limit for card ${cardId} for user ${user.id}`);

    const card = await this.verifyCardOwnership(user, cardId);

    if (!card.provider_ref) {
      this.logger.error(`Card provider reference not found for card: ${cardId}, user: ${user.id}`);
      throw new BadRequestException('Card provider reference not found');
    }

    if (!dto.amount && !dto.frequency) {
      this.logger.error(`At least one of amount or frequency must be provided for card: ${cardId}, user: ${user.id}`);
      throw new BadRequestException('At least one of amount or frequency must be provided');
    }

    try {
      const updateRequest: any = {};

      if (dto.amount !== undefined || dto.frequency !== undefined) {
        updateRequest.limit = {
          amount: dto.amount ?? card.limit ?? 0,
          frequency:
            dto.frequency ?? (card.limit_frequency as CardLimitFrequency) ?? CardLimitFrequency.PER_30_DAY_PERIOD,
        };
      }

      const providerUpdatedCard = await this.cardAdapter.updateCard(card.provider_ref, updateRequest);
      this.logger.log(`Card ${cardId} limit updated successfully with provider`);

      const updatedCard = await this.cardRepository.update(
        { id: cardId },
        {
          limit: providerUpdatedCard.limitAmount,
          limit_frequency: providerUpdatedCard.limitFrequency,
        },
      );

      if (!updatedCard) {
        this.logger.error(`Failed to update card limit for card: ${cardId}, user: ${user.id}`);
        throw new Error(`Failed to update card limit for card: ${cardId}`);
      }

      // Verify the update was successful
      const verifiedCard = await this.cardRepository.findOne({ id: cardId });
      if (Number(verifiedCard.limit || 0) !== Number(providerUpdatedCard.limitAmount || 0)) {
        this.logger.error(
          `Card limit update verification failed for card: ${cardId}, user: ${user.id}. Expected: ${providerUpdatedCard.limitAmount}, Actual: ${verifiedCard.limit}`,
        );
        throw new Error(
          `Card limit update verification failed. Expected: ${providerUpdatedCard.limitAmount}, Actual: ${verifiedCard.limit}`,
        );
      }

      if (verifiedCard.limit_frequency !== providerUpdatedCard.limitFrequency) {
        this.logger.error(
          `Card limit frequency update verification failed for card: ${cardId}, user: ${user.id}. Expected: ${providerUpdatedCard.limitFrequency}, Actual: ${verifiedCard.limit_frequency}`,
        );
        throw new Error(
          `Card limit frequency update verification failed. Expected: ${providerUpdatedCard.limitFrequency}, Actual: ${verifiedCard.limit_frequency}`,
        );
      }

      this.logger.log(`Card ${cardId} limit updated successfully in database`);

      return {
        card_id: cardId,
        limit: providerUpdatedCard.limitAmount,
        limit_frequency: providerUpdatedCard.limitFrequency,
      };
    } catch (error) {
      this.logger.error(`Failed to update card limit for card ${cardId}, user: ${user.id}`, error);
      throw new BadRequestException(`Failed to update card limit: ${error.message}`);
    }
  }

  async getCardTransactions(
    userId: string,
    filters: ICardTransactionFilters = {},
  ): Promise<IPaginatedResponse<CardTransactionModel>> {
    const cardUser = await this.cardUserRepository.findOne({ user_id: userId });

    if (!cardUser) {
      return {
        card_transactions: [],
        pagination: {
          current_page: filters.page || 1,
          next_page: 0,
          previous_page: 0,
          limit: filters.limit || 10,
          page_count: 0,
          total: 0,
        },
      } as IPaginatedResponse<CardTransactionModel>;
    }

    const query: Record<string, any> = {
      user_id: userId,
      card_user_id: cardUser.id,
    };

    if (filters.card_id) {
      query.card_id = filters.card_id;
    }

    if (filters.transaction_type) {
      query.transaction_type = filters.transaction_type;
    }

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.currency) {
      query.currency = filters.currency;
    }

    if (filters.provider_reference) {
      query.provider_reference = filters.provider_reference;
    }

    if (filters.type) {
      query.type = filters.type;
    }

    const params: any = { page: filters.page, limit: filters.limit, endDateCol: 'created_at' };

    if (filters.start_date) {
      const startDateTime = DateTime.fromISO(filters.start_date, { zone: 'utc' }).startOf('day').toSQL();
      params.startDate = startDateTime;
    }

    if (filters.end_date) {
      const endDateTime = DateTime.fromISO(filters.end_date, { zone: 'utc' }).endOf('day').toSQL();
      params.endDate = endDateTime;
    }

    if (filters.search) {
      params.search = filters.search;
      params.filterBy = 'merchant_name';
    }

    const result = await this.cardTransactionRepository.findAllWithCardLastFourDigits(query, params);

    if (result.card_transactions) {
      result.card_transactions = result.card_transactions.map((transaction: any) => {
        if (transaction.card) {
          transaction.last_four_digits = transaction.card.last_four_digits;
          delete transaction.card;
        }
        return transaction;
      });
    }

    return result;
  }

  async getCardTransaction(id: string, userId: string): Promise<CardTransactionModel & { last_four_digits?: string }> {
    const cardTransaction = await this.cardTransactionRepository.findByIdWithCardLastFourDigits(id, userId);

    if (!cardTransaction) {
      this.logger.error(`Card transaction with ID ${id} not found for user: ${userId}`);
      throw new NotFoundException('Card transaction not found');
    }

    const result = cardTransaction as CardTransactionModel & {
      last_four_digits?: string;
      card?: { last_four_digits?: string };
    };

    if (result.card) {
      result.last_four_digits = result.card.last_four_digits;
      delete result.card;
    }

    return result;
  }

  async getCardTransactionFee(
    transactionAmount: number,
    feeType: CardFeeType,
  ): Promise<{
    fee: number;
    feePercentage?: number;
    feeFixed?: number;
    feeType: string;
  }> {
    this.logger.log(`Calculating fee for transaction amount: ${transactionAmount}, fee type: ${feeType}`);

    const feeCalculation = CardFeesService.calculateFee(transactionAmount, feeType);

    // Convert USD fee to cents without flooring, so we can apply ceiling correctly
    const rawFeeInCents = multiply(feeCalculation.fee, 100);

    // Always round fee up to the next whole cent to avoid undercharging
    let feeInCents = Math.ceil(rawFeeInCents);

    // Ensure that any positive fee is at least 1 cent
    if (rawFeeInCents > 0 && feeInCents === 0) {
      this.logger.log(`Fee ${rawFeeInCents} cents rounded below 1 cent. Setting to 1 cent minimum.`);
      feeInCents = 1;
    }

    this.logger.log(
      `Calculated fee: ${feeInCents} cents (${feeCalculation.fee} USD) for transaction amount: ${transactionAmount}`,
    );

    return {
      fee: feeInCents,
      feePercentage: feeCalculation.feePercentage,
      feeFixed: feeCalculation.feeFixed,
      feeType: feeCalculation.feeType,
    };
  }

  getCardFeeConfig(feeType: CardFeeType) {
    return CardFeesService.getFeeConfig(feeType);
  }

  requiresChargeApi(feeType: CardFeeType): boolean {
    return CardFeesService.requiresChargeApi(feeType);
  }

  async checkAndChargeIssuanceFeeOnFirstFunding(
    cardId: string,
    cardUser: ICardUser,
    fundingTransaction: ICardTransaction,
  ): Promise<void> {
    if (!cardId) {
      return;
    }

    const card = await this.cardRepository.findOne({ id: cardId });
    if (card?.issuance_fee_status !== IIssuanceFeeStatus.PENDING) {
      return;
    }

    // Check if there are any previous successful deposit transactions (excluding current one)
    const previousSuccessfulDeposits = await this.cardTransactionRepository.findPreviousSuccessfulDeposits(
      card.id,
      fundingTransaction.id,
    );

    // Only charge issuance fee if this is the first successful deposit
    if (previousSuccessfulDeposits.length === 0) {
      await this.chargeIssuanceFee(card, cardUser, fundingTransaction);
    }
  }

  async chargeIssuanceFee(card: ICard, cardUser: ICardUser, fundingTransaction: ICardTransaction): Promise<void> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Get fee configuration
        const feeCalculation = CardFeesService.calculateFee(0, CardFeeType.VIRTUAL_CARD_ISSUANCE);
        const feeInUSD = feeCalculation.fee; // $1
        const feeInCents = CurrencyUtility.formatCurrencyAmountToSmallestUnit(feeInUSD, 'USD'); // 100 cents

        if (feeInCents <= 0) {
          this.logger.log('Issuance fee is 0, skipping fee charge');
          return;
        }

        // Use lock to prevent concurrent charges
        const lockKey = `issuance-fee:card:${card.id}`;
        return await this.lockerService.withLock(lockKey, async () => {
          // Re-check status within lock to prevent duplicate charges
          const lockedCard = await this.cardRepository.findOne({ id: card.id });
          if (lockedCard?.issuance_fee_status !== IIssuanceFeeStatus.PENDING) {
            this.logger.log(`Issuance fee already processed for card ${card.id}, skipping`);
            return;
          }

          return await this.cardTransactionRepository.transaction(async (trx) => {
            // Re-fetch cardUser within transaction to get latest balance
            const lockedCardUser = await this.cardUserRepository.findOne({ id: cardUser.id }, {}, { trx });
            if (!lockedCardUser) {
              this.logger.error(`Card user not found during issuance fee charge: ${cardUser.id}, card: ${card.id}`);
              throw new NotFoundException('Card user not found during issuance fee charge');
            }

            // Charge fee via Rain API first to get provider reference
            const feeInRainUnits = feeInCents;
            let chargeProviderRef: string | null = null;
            let isFeeSettled = false;

            try {
              const chargeResponse = await this.cardAdapter.createCharge(
                lockedCardUser.provider_ref,
                feeInRainUnits,
                'Virtual card issuance fee',
              );
              chargeProviderRef = chargeResponse.providerRef;
              isFeeSettled = true;
              this.logger.log(
                `Issuance fee charged successfully. Charge ID: ${chargeProviderRef}, Amount: ${feeInCents} cents`,
              );
            } catch (chargeError) {
              this.logger.error(`Failed to charge issuance fee via Rain API: ${chargeError.message}`, chargeError);
              throw chargeError; // Re-throw to trigger retry
            }

            // Get current balances
            const currentCardBalance = Number(lockedCard.balance || 0);
            const currentCardUserBalance = Number(lockedCardUser.balance || 0);

            // Calculate new balances (allow negative)
            const newCardBalance = subtract(currentCardBalance, feeInCents);
            const newCardUserBalance = subtract(currentCardUserBalance, feeInCents);

            // Use charge provider ref
            const feeReference = chargeProviderRef || `fee-issuance-${card.id}-${Date.now()}`;

            // Create card transaction for fee
            const cardTransactionData: Partial<ICardTransaction> = {
              user_id: lockedCardUser.user_id,
              card_user_id: lockedCardUser.id,
              card_id: card.id,
              transaction_type: CardTransactionType.FEE,
              type: CardTransactionDrCr.DEBIT,
              amount: feeInCents,
              currency: 'USD',
              status: CardTransactionStatus.SUCCESSFUL,
              provider_reference: feeReference,
              provider_fee_reference: chargeProviderRef,
              is_fee_settled: isFeeSettled,
              merchant_name: 'OneDosh',
              merchant_category: 'Fee',
              description: 'Virtual card issuance fee',
              balance_before: currentCardBalance,
              balance_after: newCardBalance,
            };

            const feeCardTransaction = await this.cardTransactionRepository.create(cardTransactionData, trx);

            // Create main transaction for fee
            const mainTransactionData: Partial<ITransaction> = {
              user_id: lockedCardUser.user_id,
              reference: feeReference,
              external_reference: fundingTransaction.provider_reference,
              asset: 'USD',
              amount: feeInCents,
              balance_before: currentCardBalance,
              balance_after: newCardBalance,
              transaction_type: TransactionType.FEE,
              status: TransactionStatus.COMPLETED,
              category: TransactionCategory.CARD,
              transaction_scope: TransactionScope.INTERNAL,
              metadata: {
                feeType: CardFeeType.VIRTUAL_CARD_ISSUANCE,
                relatedTransactionId: fundingTransaction.id,
                relatedProviderReference: fundingTransaction.provider_reference,
                chargeProviderRef: chargeProviderRef,
              },
              description: 'Virtual card issuance fee',
              processed_at: DateTime.now().toSQL(),
            };

            const feeMainTransaction = await this.transactionRepository.create(mainTransactionData, trx);

            // Update card balance (allow negative)
            await this.cardRepository.update(
              { id: card.id },
              {
                balance: newCardBalance,
                issuance_fee_status: IIssuanceFeeStatus.COMPLETED,
              } as Partial<ICard>,
              { trx },
            );

            // Update card user balance (allow negative)
            await this.cardUserRepository.update(
              { id: lockedCardUser.id },
              { balance: newCardUserBalance } as Partial<ICardUser>,
              { trx },
            );

            this.logger.log(
              `Issuance fee recorded. Card Transaction: ${feeCardTransaction.id}, Main Transaction: ${feeMainTransaction.id}`,
            );

            // Send notification
            try {
              const user = await this.userRepository.findActiveById(lockedCardUser.user_id);
              if (user) {
                const displayAmount = CurrencyUtility.formatCurrencyAmountToMainUnit(feeInCents, 'USD');
                const displayBalance = CurrencyUtility.formatCurrencyAmountToMainUnit(newCardBalance, 'USD');

                await this.sendCardNotification(
                  { inApp: true, push: true },
                  {
                    userId: lockedCardUser.user_id,
                    notificationType: CardNotificationType.CARD_ISSUANCE_FEE,
                    metadata: {
                      cardId: card.id,
                      amount: displayAmount,
                      currency: 'USD',
                      transactionId: feeMainTransaction.id,
                      newBalance: displayBalance,
                      feeType: CardFeeType.VIRTUAL_CARD_ISSUANCE,
                    },
                  },
                );
              }
            } catch (notificationError) {
              this.logger.error(
                `Failed to send issuance fee notification: ${notificationError.message}`,
                notificationError,
              );
            }
          });
        });
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(
          `Failed to charge issuance fee (attempt ${attempt + 1}/${maxRetries}) for card ${card.id}: ${error.message}`,
        );
        if (attempt < maxRetries - 1) {
          // Wait before retry (exponential backoff)
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    // All retries failed - mark as failed
    if (lastError) {
      this.logger.error(`Failed to charge issuance fee after ${maxRetries} attempts for card ${card.id}`, lastError);
      try {
        await this.cardRepository.update({ id: card.id }, {
          issuance_fee_status: IIssuanceFeeStatus.FAILED,
        } as Partial<ICard>);
      } catch (updateError) {
        this.logger.error(`Failed to update issuance_fee_status to failed: ${updateError.message}`, updateError);
      }
    }
  }

  getAllCardFees() {
    const fees = CardFeesService.getAllFeeConfigs();

    return {
      fees: fees.map((fee) => ({
        feeType: fee.feeType,
        calculationType: fee.calculationType,
        percentage: fee.percentage,
        fixed: fee.fixed,
        description: fee.description,
        comment: fee.comment,
        appliedBy: fee.appliedBy,
        requiresChargeApi: fee.requiresChargeApi || false,
      })),
      minimumChargeApiFee: MINIMUM_CHARGE_API_FEE,
    };
  }

  async createDispute(user: UserModel, transactionId: string, createDisputeDto: CreateDisputeDto) {
    this.logger.log(`Creating dispute for transaction ${transactionId} by user ${user.id}`);

    const cardTransaction = await this.cardTransactionRepository.findOne({ id: transactionId, user_id: user.id });

    if (!cardTransaction) {
      this.logger.error(`Card transaction with ID ${transactionId} not found`);
      throw new NotFoundException('Card transaction not found');
    }

    if (!cardTransaction.provider_reference) {
      this.logger.error(`Transaction does not have a provider reference: ${transactionId}, user: ${user.id}`);
      throw new BadRequestException('Transaction does not have a provider reference');
    }

    if (!cardTransaction.card_id) {
      this.logger.error(`Transaction does not have a card ID: ${transactionId}, user: ${user.id}`);
      throw new BadRequestException('Transaction does not have a card ID');
    }

    if (cardTransaction.transaction_type !== CardTransactionType.SPEND) {
      this.logger.error(
        `Only purchase transactions are eligible for dispute: ${transactionId}, user: ${user.id}, type: ${cardTransaction.transaction_type}`,
      );
      throw new BadRequestException('Only purchase transactions are eligible for dispute');
    }

    if (cardTransaction.status !== CardTransactionStatus.SUCCESSFUL) {
      this.logger.error(
        `Only successful transactions are eligible for dispute: ${transactionId}, user: ${user.id}, status: ${cardTransaction.status}`,
      );
      throw new BadRequestException('Only successful transactions are eligible for dispute');
    }

    const activeDisputeStatuses = new Set<CardTransactionDisputeStatus>([
      CardTransactionDisputeStatus.PENDING,
      CardTransactionDisputeStatus.IN_REVIEW,
    ]);
    const existingDispute = await this.cardTransactionDisputeRepository.findOne({ transaction_id: transactionId });

    if (existingDispute) {
      if (activeDisputeStatuses.has(existingDispute.status)) {
        this.logger.warn(
          `Dispute already exists for transaction ${transactionId} with status ${existingDispute.status}`,
        );
        return existingDispute;
      }

      this.logger.error(
        `Transaction already disputed: ${transactionId}, user: ${user.id}, status: ${existingDispute.status}`,
      );
      throw new BadRequestException('Transaction already disputed');
    }

    const card = await this.cardRepository.findOne({ id: cardTransaction.card_id, user_id: user.id });
    if (!card) {
      this.logger.error(`Card not found: ${cardTransaction.card_id}, user: ${user.id}`);
      throw new NotFoundException('Card not found');
    }

    const cardUser = await this.cardUserRepository.findOne({ user_id: user.id });
    if (!cardUser) {
      this.logger.error(`Card user not found for user: ${user.id}`);
      throw new NotFoundException('Card user not found');
    }

    const feeCalculation = CardFeesService.calculateFee(0, CardFeeType.DISPUTE_CHARGEBACK);
    const feeInUSD = feeCalculation.fee;
    const feeInCents = CurrencyUtility.formatCurrencyAmountToSmallestUnit(feeInUSD, 'USD');

    if (feeInCents <= 0) {
      this.logger.error(`Dispute fee is invalid: ${transactionId}, user: ${user.id}, feeInCents: ${feeInCents}`);
      throw new BadRequestException('Dispute fee is invalid');
    }

    const currentCardBalance = Number(card.balance || 0);
    this.logger.log(`Current card balance: ${currentCardBalance}`);
    this.logger.log(`Fee in cents: ${feeInCents}`);

    if (currentCardBalance < feeInCents) {
      this.logger.error(
        `Insufficient balance for dispute: ${transactionId}, user: ${user.id}. Required: $${CurrencyUtility.formatCurrencyAmountToMainUnit(feeInCents, 'USD').toFixed(2)}, Available: $${CurrencyUtility.formatCurrencyAmountToMainUnit(currentCardBalance, 'USD').toFixed(2)}`,
      );
      throw new BadRequestException(
        `Insufficient balance. Required: $${CurrencyUtility.formatCurrencyAmountToMainUnit(feeInCents, 'USD').toFixed(2)}, Available: $${CurrencyUtility.formatCurrencyAmountToMainUnit(currentCardBalance, 'USD').toFixed(2)}`,
      );
    }

    const lockKey = `dispute:transaction:${transactionId}`;
    return await this.lockerService.withLock(lockKey, async () => {
      return await this.cardTransactionRepository.transaction(async (trx) => {
        const lockedCardUser = await this.cardUserRepository.findOne({ id: cardUser.id }, {}, { trx });
        if (!lockedCardUser) {
          this.logger.error(
            `Card user not found during dispute creation: ${cardUser.id}, transaction: ${transactionId}, user: ${user.id}`,
          );
          throw new NotFoundException('Card user not found during dispute creation');
        }

        const lockedCardTransaction = await this.cardTransactionRepository.findOne({ id: transactionId }, {}, { trx });
        if (!lockedCardTransaction) {
          this.logger.error(`Card transaction not found during dispute creation: ${transactionId}, user: ${user.id}`);
          throw new NotFoundException('Card transaction not found during dispute creation');
        }

        if (lockedCardTransaction.transaction_type !== CardTransactionType.SPEND) {
          this.logger.error(
            `Only purchase transactions are eligible for dispute: ${transactionId}, user: ${user.id}, type: ${lockedCardTransaction.transaction_type}`,
          );
          throw new BadRequestException('Only purchase transactions are eligible for dispute');
        }

        if (lockedCardTransaction.status !== CardTransactionStatus.SUCCESSFUL) {
          this.logger.error(
            `Only successful transactions are eligible for dispute: ${transactionId}, user: ${user.id}, status: ${lockedCardTransaction.status}`,
          );
          throw new BadRequestException('Only successful transactions are eligible for dispute');
        }

        const existingDisputeInTransaction = await this.cardTransactionDisputeRepository.findOne(
          { transaction_id: transactionId },
          undefined,
          { trx },
        );

        if (existingDisputeInTransaction) {
          if (activeDisputeStatuses.has(existingDisputeInTransaction.status)) {
            this.logger.warn(
              `Dispute already exists for transaction ${transactionId} with status ${existingDisputeInTransaction.status}`,
            );
            return existingDisputeInTransaction;
          }

          this.logger.error(
            `Transaction already disputed: ${transactionId}, user: ${user.id}, status: ${existingDisputeInTransaction.status}`,
          );
          throw new BadRequestException('Transaction already disputed');
        }

        const lockedCard = await this.cardRepository.findOne({ id: card.id }, {}, { trx });
        if (!lockedCard) {
          this.logger.error(
            `Card not found during dispute creation: ${card.id}, transaction: ${transactionId}, user: ${user.id}`,
          );
          throw new NotFoundException('Card not found during dispute creation');
        }

        const recheckedBalance = Number(lockedCard.balance || 0);
        this.logger.log(`Rechecked balance: ${recheckedBalance}`);
        this.logger.log(`Fee in cents: ${feeInCents}`);
        if (recheckedBalance < feeInCents) {
          this.logger.error(
            `Insufficient balance for dispute: ${transactionId}, user: ${user.id}. Required: $${CurrencyUtility.formatCurrencyAmountToMainUnit(feeInCents, 'USD').toFixed(2)}, Available: $${CurrencyUtility.formatCurrencyAmountToMainUnit(recheckedBalance, 'USD').toFixed(2)}`,
          );
          throw new BadRequestException(
            `Insufficient balance. Required: $${CurrencyUtility.formatCurrencyAmountToMainUnit(feeInCents, 'USD').toFixed(2)}, Available: $${CurrencyUtility.formatCurrencyAmountToMainUnit(recheckedBalance, 'USD').toFixed(2)}`,
          );
        }

        let disputeResponse: RainDisputeResponse;
        try {
          disputeResponse = await this.cardAdapter.createDispute(
            lockedCardTransaction.provider_reference,
            createDisputeDto.textEvidence,
          );
          this.logger.log(`Dispute created successfully. Dispute ID: ${disputeResponse.id}`);
        } catch (disputeError) {
          this.logger.error(`Failed to create dispute via Rain API: ${transactionId}, user: ${user.id}`, disputeError);
          throw new BadRequestException(`Failed to create dispute: ${disputeError.message}`);
        }

        const feeInRainUnits = feeInCents;
        let chargeResponse: CardChargeResponse | null = null;
        let chargeProviderRef: string | null = null;
        let isFeeSettled = false;

        try {
          chargeResponse = await this.cardAdapter.createCharge(
            lockedCardUser.provider_ref,
            feeInRainUnits,
            'Dispute/chargeback fee',
          );
          chargeProviderRef = chargeResponse.providerRef;
          isFeeSettled = true;
          this.logger.log(
            `Dispute fee charged successfully. Charge ID: ${chargeProviderRef}, Amount: ${feeInCents} cents`,
          );
        } catch (chargeError) {
          this.logger.error(
            `Failed to charge dispute fee via Rain API: ${transactionId}, user: ${user.id}`,
            chargeError,
          );
          throw new BadRequestException(`Failed to charge dispute fee: ${chargeError.message}`);
        }

        const newCardBalance = subtract(recheckedBalance, feeInCents);
        const currentCardUserBalance = Number(lockedCardUser.balance || 0);
        const newCardUserBalance = subtract(currentCardUserBalance, feeInCents);

        const feeReference = chargeProviderRef || `fee-dispute-${transactionId}-${Date.now()}`;

        const feeCardTransactionData: Partial<ICardTransaction> = {
          user_id: lockedCardUser.user_id,
          card_user_id: lockedCardUser.id,
          card_id: lockedCardTransaction.card_id,
          transaction_type: CardTransactionType.FEE,
          type: CardTransactionDrCr.DEBIT,
          amount: feeInCents,
          currency: CurrencyCode.USD,
          status: CardTransactionStatus.SUCCESSFUL,
          provider_reference: feeReference,
          provider_fee_reference: chargeProviderRef,
          is_fee_settled: isFeeSettled,
          merchant_name: 'OneDosh',
          merchant_category: 'Fee',
          description: 'Dispute/chargeback fee',
          balance_before: recheckedBalance,
          balance_after: newCardBalance,
        };

        const feeCardTransaction = await this.cardTransactionRepository.create(feeCardTransactionData, trx);

        const feeMainTransactionData: Partial<ITransaction> = {
          user_id: lockedCardUser.user_id,
          reference: feeReference,
          external_reference: lockedCardTransaction.provider_reference,
          asset: CurrencyCode.USD,
          amount: feeInCents,
          balance_before: recheckedBalance,
          balance_after: newCardBalance,
          transaction_type: TransactionType.FEE,
          status: TransactionStatus.COMPLETED,
          category: TransactionCategory.CARD,
          transaction_scope: TransactionScope.INTERNAL,
          metadata: {
            feeType: CardFeeType.DISPUTE_CHARGEBACK,
            relatedTransactionId: transactionId,
            relatedProviderReference: lockedCardTransaction.provider_reference,
            chargeProviderRef: chargeProviderRef,
            chargeTransaction: chargeResponse
              ? {
                  providerRef: chargeResponse.providerRef,
                  createdAt: chargeResponse.createdAt,
                  amount: chargeResponse.amount,
                  description: chargeResponse.description,
                }
              : null,
          },
          description: 'Dispute/chargeback fee',
          processed_at: DateTime.now().toSQL(),
        };

        const feeMainTransaction = await this.transactionRepository.create(feeMainTransactionData, trx);

        await this.cardRepository.update({ id: lockedCard.id }, { balance: newCardBalance } as Partial<ICard>, { trx });

        await this.cardUserRepository.update(
          { id: lockedCardUser.id },
          { balance: newCardUserBalance } as Partial<ICardUser>,
          { trx },
        );

        const disputeData: Partial<ICardTransactionDispute> = {
          transaction_id: transactionId,
          provider_dispute_ref: disputeResponse.id,
          transaction_ref: disputeResponse.transactionId,
          status: disputeResponse.status as CardTransactionDisputeStatus,
          text_evidence: disputeResponse.textEvidence,
          resolved_at: disputeResponse.resolvedAt ? DateTime.fromISO(disputeResponse.resolvedAt).toJSDate() : undefined,
        };

        const dispute = await this.cardTransactionDisputeRepository.create(disputeData, trx);

        const disputeEventData: Partial<ICardTransactionDisputeEvent> = {
          dispute_id: dispute.id,
          previous_status: undefined,
          new_status: dispute.status,
          event_type: CardTransactionDisputeEventType.CREATED,
          triggered_by: CardTransactionDisputeTriggeredBy.USER,
          user_id: user.id,
        };

        await this.cardTransactionDisputeEventRepository.create(disputeEventData, trx);

        this.logger.log(
          `Dispute created. Dispute ID: ${dispute.id}, Fee Card Transaction: ${feeCardTransaction.id}, Main Transaction: ${feeMainTransaction.id}`,
        );

        return dispute;
      });
    });
  }

  async getTransactionDisputeEligibility(user: UserModel, transactionId: string) {
    this.logger.log(`Checking dispute eligibility for transaction ${transactionId} by user ${user.id}`);

    const cardTransaction = await this.cardTransactionRepository.findOne({ id: transactionId, user_id: user.id });

    if (!cardTransaction) {
      this.logger.error(`Card transaction with ID ${transactionId} not found for user: ${user.id}`);
      throw new NotFoundException('Card transaction not found');
    }

    const reasons: string[] = [];

    const isCardTransaction = !!cardTransaction.card_id;
    if (!isCardTransaction) {
      reasons.push('Transaction is not a card transaction');
    }

    const isPurchaseTransaction = cardTransaction.transaction_type === CardTransactionType.SPEND;
    if (!isPurchaseTransaction) {
      reasons.push('Only purchase transactions are eligible for dispute');
    }

    if (this.isAtmTransaction(cardTransaction)) {
      reasons.push('ATM transactions are not eligible for dispute');
    }

    const isPostedOrSettled = cardTransaction.status === CardTransactionStatus.SUCCESSFUL;
    if (!isPostedOrSettled) {
      reasons.push('Only posted/settled transactions are eligible for dispute');
    }

    const createdAt =
      cardTransaction.created_at instanceof Date
        ? DateTime.fromJSDate(cardTransaction.created_at)
        : DateTime.fromISO(String(cardTransaction.created_at));
    const now = DateTime.utc();
    const ageInDays = now.diff(createdAt, 'days').days;

    if (Number.isFinite(ageInDays) && ageInDays > 60) {
      reasons.push('Transaction is outside the 60-day dispute window');
    }

    const activeDisputeStatuses = new Set<CardTransactionDisputeStatus>([
      CardTransactionDisputeStatus.PENDING,
      CardTransactionDisputeStatus.IN_REVIEW,
    ]);
    const existingDispute = await this.cardTransactionDisputeRepository.findOne({ transaction_id: transactionId });

    if (existingDispute && activeDisputeStatuses.has(existingDispute.status)) {
      reasons.push('Transaction already has an open dispute');
    }

    if (existingDispute && existingDispute.status === CardTransactionDisputeStatus.ACCEPTED) {
      reasons.push('Transaction already has a resolved chargeback');
    }

    const isRefundOrReversal =
      cardTransaction.transaction_type === CardTransactionType.REFUND ||
      cardTransaction.transaction_type === CardTransactionType.REVERSAL;

    if (isRefundOrReversal) {
      reasons.push('Refunded or reversed transactions are not eligible for dispute');
    }

    const canDispute = reasons.length === 0;

    const isAlreadyDisputed = !!existingDispute;
    const disputeStatus = existingDispute?.status;

    let disputeEvents: CardTransactionDisputeEventModel[] = [];
    if (existingDispute) {
      const events = await this.cardTransactionDisputeEventRepository.findSync({
        dispute_id: existingDispute.id,
      });
      disputeEvents = events || [];
    }

    return {
      transaction_id: transactionId,
      canDispute,
      reasons,
      events: disputeEvents,
      ...(canDispute && {
        isAlreadyDisputed,
        ...(isAlreadyDisputed && { disputeStatus }),
      }),
    };
  }

  /**
   * Validate card and card user for funding
   */
  private async validateCardAndCardUserForFunding(
    user: UserModel,
    cardId: string,
  ): Promise<{ card: ICard; cardUser: ICardUser }> {
    const card = await this.verifyCardOwnership(user, cardId);
    if (card.status === ICardStatus.CANCELED || card.status === ICardStatus.BLOCKED) {
      throw new BadRequestException('Cannot fund a blocked or canceled card');
    }

    const cardUser = await this.cardUserRepository.findOne({ user_id: user.id });
    if (!cardUser) {
      throw new NotFoundException('Card user not found');
    }

    return { card, cardUser };
  }

  /**
   * Get and validate Rain deposit address for card funding
   */
  private async getRainDepositAddressForCardFunding(userId: string, chainInfo: ReturnType<typeof getChainInfoFromId>) {
    let depositAddress = await this.depositAddressRepository.findOne({
      user_id: userId,
      provider: 'rain',
      asset: chainInfo.chainName,
    });

    if (!depositAddress) {
      if (EnvironmentService.isProduction()) {
        this.logger.error(`Deposit address not available for ${chainInfo.chainName} for user: ${userId}`);
        throw new BadRequestException(
          `Deposit address not available for ${chainInfo.chainName}. Please set up your deposit address first.`,
        );
      } else {
        depositAddress = await this.depositAddressRepository.findLatestRainDepositAddressByUserId(userId);
        if (!depositAddress) {
          this.logger.error(`Deposit address not available for ${chainInfo.chainName} for user: ${userId}`);
          throw new BadRequestException(
            `Deposit address not available for ${chainInfo.chainName}. Please set up your deposit address first.`,
          );
        }
      }
    }

    if (EnvironmentService.isProduction() && depositAddress.asset !== chainInfo.chainName) {
      this.logger.error(
        `Deposit address must be for the default chain ${chainInfo.chainName} in production for user: ${userId}, actual asset: ${depositAddress.asset}`,
      );
      throw new BadRequestException(
        `Deposit address must be for the default chain ${chainInfo.chainName} in production.`,
      );
    }

    return depositAddress;
  }

  /**
   * Get currency and network from underlying currency config
   */
  private getCurrencyAndNetworkFromConfig(): { currency: string; network: string } {
    const underlyingCryptoAsset = EnvironmentService.isProduction()
      ? EnvironmentService.getValue('DEFAULT_UNDERLYING_CURRENCY')
      : 'USDC.ETH';

    if (!underlyingCryptoAsset) {
      throw new BadRequestException('Default underlying currency not configured');
    }

    const [currency, rawNetwork] = underlyingCryptoAsset.split('.');
    if (!currency || !rawNetwork) {
      throw new BadRequestException(
        `Invalid underlying currency format: ${underlyingCryptoAsset}. Expected format: CURRENCY.NETWORK`,
      );
    }

    // Map network for YellowCard compatibility (ETH -> ERC20)
    const network = rawNetwork === 'ETH' ? 'ERC20' : rawNetwork;

    return { currency, network };
  }

  /**
   * Validate minimum funding amount in production
   */
  private async validateMinimumFundingAmount(cardId: string, usdAmount: number, errorMessage?: string): Promise<void> {
    if (!EnvironmentService.isProduction()) {
      return;
    }

    const previousSuccessfulDeposits =
      (await this.cardTransactionRepository.findPreviousSuccessfulDeposits(cardId)) || [];
    const hasSuccessfulDeposit = previousSuccessfulDeposits.length > 0;
    const minimumAmount = hasSuccessfulDeposit ? CARD_SUBSEQUENT_FUNDING_MIN_USD : CARD_INITIAL_FUNDING_MIN_USD;

    if (usdAmount < minimumAmount) {
      const message =
        errorMessage ||
        `After exchange, USD amount (${usdAmount.toFixed(2)}) is less than minimum (${minimumAmount.toFixed(2)})`;
      throw new BadRequestException(message);
    }
  }

  /**
   * Calculate card funding fee from USD amount
   */
  private async calculateCardFundingFee(usdAmount: number): Promise<number> {
    this.logger.log(`[NGN_CARD_FUNDING] Calculating card funding fee for USD amount: ${usdAmount} USD`);
    const feeCalculation = await this.getCardTransactionFee(usdAmount, CardFeeType.FIAT_TOP_UP);
    const feeInCents = Math.max(1, feeCalculation.fee);
    const feeInUSD = CurrencyUtility.formatCurrencyAmountToMainUnit(feeInCents, 'USD');
    this.logger.log(
      `[NGN_CARD_FUNDING] Card funding fee calculated: ${feeInCents} cents (${feeInUSD} USD) for ${usdAmount} USD`,
    );
    return feeInUSD;
  }

  async initializeCardFundingFromNGN(
    user: UserModel,
    cardId: string,
    dto: InitiateCardFundingFromNGNDto,
  ): Promise<any> {
    const lockKey = `card_funding_init_ngn:${user.id}:${cardId}`;

    return await this.lockerService.withLock(
      lockKey,
      async () => {
        const { card, cardUser } = await this.validateCardAndCardUserForFunding(user, cardId);

        const defaultChainId = this.getDefaultChainId();
        const chainInfo = getChainInfoFromId(defaultChainId);
        if (!chainInfo) {
          throw new BadRequestException('Default chain not configured for card funding');
        }

        const depositAddress = await this.getRainDepositAddressForCardFunding(user.id, chainInfo);
        const { currency, network } = this.getCurrencyAndNetworkFromConfig();

        this.logger.log(
          `[NGN_CARD_FUNDING] Step 1 - Initialize: Input NGN amount: ${dto.amount} NGN (${CurrencyUtility.formatCurrencyAmountToMainUnit(dto.amount, 'NGN')} NGN)`,
        );

        const exchangeInit = await this.ngToUsdExchangeService.initializeNgToUSDExchange(
          user.id,
          {
            from: SUPPORTED_CURRENCIES.NGN.code,
            to: SUPPORTED_CURRENCIES.USD.code,
            amount: dto.amount,
            rate_id: dto.rate_id,
          },
          {
            destinationWalletAddress: {
              address: depositAddress.address,
              currency: currency,
              network: network,
            },
          },
        );
        this.logger.log(`[NGN_CARD_FUNDING] Step 1 - Exchange init`, exchangeInit);

        const usdAmountAfterExchange = exchangeInit.amountToReceiveUSD;
        this.logger.log(
          `[NGN_CARD_FUNDING] Step 1 - Initialize: Exchange initialized - USD amount after exchange: ${usdAmountAfterExchange} USD`,
        );
        this.logger.log(
          `[NGN_CARD_FUNDING] Step 1 - Initialize: Exchange fee (NGN): ${exchangeInit.feeLocal} kobo (${CurrencyUtility.formatCurrencyAmountToMainUnit(exchangeInit.feeLocal, 'NGN')} NGN)`,
        );
        this.logger.log(
          `[NGN_CARD_FUNDING] Step 1 - Initialize: Exchange fee (USD): ${exchangeInit.feeUSD} cents (${CurrencyUtility.formatCurrencyAmountToMainUnit(exchangeInit.feeUSD, 'USD')} USD)`,
        );
        this.logger.log(
          `[NGN_CARD_FUNDING] Step 1 - Initialize: Total NGN to be debited: ${exchangeInit.totalAmountToPayLocal} kobo (${CurrencyUtility.formatCurrencyAmountToMainUnit(exchangeInit.totalAmountToPayLocal, 'NGN')} NGN)`,
        );

        await this.validateMinimumFundingAmount(card.id, usdAmountAfterExchange);

        const cardFeeUSD = await this.calculateCardFundingFee(usdAmountAfterExchange);
        const netUsdUserWillReceive = subtract(usdAmountAfterExchange, cardFeeUSD);
        this.logger.log(
          `[NGN_CARD_FUNDING] Step 1 - Initialize: Net USD user will receive (raw): ${netUsdUserWillReceive} USD (${usdAmountAfterExchange} USD - ${cardFeeUSD} USD card fee)`,
        );

        // Calculate the actual amount that will be stored after floor() conversion
        const amountInCents = CurrencyUtility.formatCurrencyAmountToSmallestUnit(netUsdUserWillReceive, 'USD');
        const actualNetUsdAmount = CurrencyUtility.formatCurrencyAmountToMainUnit(amountInCents, 'USD');
        const feeInCents = CurrencyUtility.formatCurrencyAmountToSmallestUnit(cardFeeUSD, 'USD');
        const actualCardFeeUSD = CurrencyUtility.formatCurrencyAmountToMainUnit(feeInCents, 'USD');

        // Calculate card balance after funding
        const currentCardBalanceInCents = Number(card.balance || 0);
        const cardBalanceAfterFundingInCents = add(currentCardBalanceInCents, amountInCents);
        const cardBalanceAfterFunding = CurrencyUtility.formatCurrencyAmountToMainUnit(
          cardBalanceAfterFundingInCents,
          'USD',
        );

        this.logger.log(
          `[NGN_CARD_FUNDING] Step 1 - Initialize: Net USD user will receive (after floor): ${actualNetUsdAmount} USD`,
        );
        this.logger.log(
          `[NGN_CARD_FUNDING] Step 1 - Initialize: Current card balance: ${CurrencyUtility.formatCurrencyAmountToMainUnit(currentCardBalanceInCents, 'USD')} USD`,
        );
        this.logger.log(
          `[NGN_CARD_FUNDING] Step 1 - Initialize: Card balance after funding: ${cardBalanceAfterFunding} USD`,
        );

        const cardFundingContext = {
          cardId: card.id,
          cardUserId: cardUser.id,
          userId: user.id,
          depositAddress: depositAddress.address,
          usdAmountAfterExchange: usdAmountAfterExchange,
          cardFeeUSD: cardFeeUSD,
          netUsdUserWillReceive: netUsdUserWillReceive,
          rateId: dto.rate_id,
          ngnAmount: dto.amount,
        };

        await this.ngToUsdExchangeEscrowService.storeCardFundingContext(
          exchangeInit.sourceTransactionId,
          cardFundingContext,
        );

        return {
          transaction_id: exchangeInit.sourceTransactionId,
          card_id: cardId,
          ngn_amount: dto.amount,
          usd_amount_after_exchange: usdAmountAfterExchange,
          exchange_fee_ngn: exchangeInit.feeLocal,
          exchange_fee_usd: exchangeInit.feeUSD,
          card_fee_usd: actualCardFeeUSD,
          net_usd_you_will_receive: actualNetUsdAmount,
          card_balance_after_funding: cardBalanceAfterFunding,
          total_ngn_debited: exchangeInit.totalAmountToPayLocal,
          rate: exchangeInit.rateInMainUnit,
          rate_id: dto.rate_id,
          expiration_time: exchangeInit.expirationTime,
          minimum_local_amount: exchangeInit.minimumLocalAmount,
          maximum_local_amount: exchangeInit.maximumLocalAmount,
        };
      },
      { ttl: 30000, retryCount: 5, retryDelay: 500 },
    );
  }

  /**
   * Execute card funding from NGN wallet (Step 2 of 2-step flow)
   * This method:
   * 1. Retrieves card funding context from Redis (stored in initialize step)
   * 2. Validates context matches user and card
   * 3. Creates card transaction record with PENDING status
   * 4. Links card transaction to parent exchange transaction
   * 5. Queues background processor to handle NGN transfer to YellowCard
   *
   * Note: The card transaction amount is the net USD user will receive (after card fee).
   * The card fee will be deducted from card balance after Rain credits the card.
   *
   * @param user - The user executing the card funding
   * @param cardId - The card ID to fund
   * @param dto - Contains exchange transaction reference and transaction PIN
   * @returns Card transaction details and background job ID
   */
  async executeCardFundingFromNGN(user: UserModel, cardId: string, dto: ExecuteCardFundingFromNGNDto): Promise<any> {
    const lockKey = `card_funding_exec_ngn:${user.id}:${cardId}:${dto.transaction_id}`;

    return await this.lockerService.withLock(
      lockKey,
      async () => {
        // Validate card ownership and status
        const card = await this.verifyCardOwnership(user, cardId);
        if (card.status === ICardStatus.CANCELED || card.status === ICardStatus.BLOCKED) {
          throw new BadRequestException('Cannot fund a blocked or canceled card');
        }

        const cardUser = await this.cardUserRepository.findOne({ user_id: user.id });
        if (!cardUser) {
          throw new NotFoundException('Card user not found');
        }

        // Retrieve card funding context stored in initialize step
        const cardFundingContext = await this.ngToUsdExchangeEscrowService.getCardFundingContext(dto.transaction_id);

        if (!cardFundingContext) {
          throw new BadRequestException('Card funding context not found. Please initialize first.');
        }

        // Validate context matches current request
        if (cardFundingContext.cardId !== cardId) {
          throw new BadRequestException('Card ID mismatch');
        }

        if (cardFundingContext.userId !== user.id) {
          throw new BadRequestException('User ID mismatch');
        }

        // Convert amounts to smallest units (cents) for storage
        this.logger.log(
          `[NGN_CARD_FUNDING] Step 2 - Execute: Starting execution with context - NGN amount: ${cardFundingContext.ngnAmount} kobo (${CurrencyUtility.formatCurrencyAmountToMainUnit(cardFundingContext.ngnAmount, 'NGN')} NGN)`,
        );
        this.logger.log(
          `[NGN_CARD_FUNDING] Step 2 - Execute: USD amount after exchange: ${cardFundingContext.usdAmountAfterExchange} USD`,
        );
        this.logger.log(`[NGN_CARD_FUNDING] Step 2 - Execute: Card fee (USD): ${cardFundingContext.cardFeeUSD} USD`);
        this.logger.log(
          `[NGN_CARD_FUNDING] Step 2 - Execute: Net USD user will receive: ${cardFundingContext.netUsdUserWillReceive} USD`,
        );

        const amountInCents = CurrencyUtility.formatCurrencyAmountToSmallestUnit(
          cardFundingContext.netUsdUserWillReceive,
          'USD',
        );
        const feeInCents = CurrencyUtility.formatCurrencyAmountToSmallestUnit(cardFundingContext.cardFeeUSD, 'USD');
        const balanceBeforeInCents = Number(card.balance || 0);
        const balanceAfterInCents = add(balanceBeforeInCents, amountInCents);

        this.logger.log(
          `[NGN_CARD_FUNDING] Step 2 - Execute: Net USD amount (raw): ${cardFundingContext.netUsdUserWillReceive} USD`,
        );
        this.logger.log(
          `[NGN_CARD_FUNDING] Step 2 - Execute: Amount in cents (after floor): ${amountInCents} cents (${CurrencyUtility.formatCurrencyAmountToMainUnit(amountInCents, 'USD')} USD)`,
        );
        this.logger.log(
          `[NGN_CARD_FUNDING] Step 2 - Execute: Fee in cents: ${feeInCents} cents (${CurrencyUtility.formatCurrencyAmountToMainUnit(feeInCents, 'USD')} USD)`,
        );
        this.logger.log(
          `[NGN_CARD_FUNDING] Step 2 - Execute: Card balance before: ${balanceBeforeInCents} cents (${CurrencyUtility.formatCurrencyAmountToMainUnit(balanceBeforeInCents, 'USD')} USD)`,
        );
        this.logger.log(
          `[NGN_CARD_FUNDING] Step 2 - Execute: Card balance after (expected): ${balanceAfterInCents} cents (${CurrencyUtility.formatCurrencyAmountToMainUnit(balanceAfterInCents, 'USD')} USD)`,
        );

        // Create card transaction record with PENDING status
        // Amount stored is net USD user will receive (card fee will be deducted later by Rain)
        // parent_exchange_transaction_id will be set later in the processor after the transaction is created
        const cardTransaction = await this.cardTransactionRepository.create({
          user_id: user.id,
          card_user_id: cardUser.id,
          card_id: card.id,
          amount: amountInCents,
          currency: 'USD',
          merchant_name: 'Card Funding',
          status: CardTransactionStatus.PENDING,
          transaction_type: CardTransactionType.DEPOSIT,
          type: CardTransactionDrCr.CREDIT,
          balance_before: balanceBeforeInCents,
          balance_after: balanceAfterInCents,
          description: `Card Funding from NGN wallet (via exchange)`,
          fee: feeInCents,
          parent_exchange_transaction_id: null, // Will be set after transaction is created in processor
        });

        // Update context with card transaction ID for webhook processing
        await this.ngToUsdExchangeEscrowService.updateCardFundingContext(dto.transaction_id, {
          ...cardFundingContext,
          cardTransactionId: cardTransaction.id,
        });

        // Queue background processor to handle:
        // 1. Accept YellowCard pay-in request
        // 2. Transfer NGN to YellowCard via Paga
        // 3. Set transactions to PENDING (webhooks will complete them)
        const job = await this.cardFundingFromNGNProcessor.queueCardFundingFromNGN({
          cardTransactionId: cardTransaction.id,
          exchangeTransactionRef: dto.transaction_id,
          userId: user.id,
          cardId: cardId,
          ngnAmount: cardFundingContext.ngnAmount,
          usdAmount: cardFundingContext.usdAmountAfterExchange,
          netUsdAmount: cardFundingContext.netUsdUserWillReceive,
          cardFeeUSD: cardFundingContext.cardFeeUSD,
          rateId: cardFundingContext.rateId,
          depositAddress: cardFundingContext.depositAddress,
        });

        return {
          transaction_id: cardTransaction.id,
          exchange_transaction_id: dto.transaction_id,
          card_id: cardId,
          card_funding_job_id: job.id,
          status: 'processing',
          message: 'Card funding initiated. Exchange and transfer in progress.',
        };
      },
      { ttl: 30000, retryCount: 5, retryDelay: 500 },
    );
  }
}
