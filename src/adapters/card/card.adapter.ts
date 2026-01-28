import { Inject, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { CardConfig, CardConfigProvider } from '../../config/card.config';
import {
  CardApplicationStatusResponse,
  CardChargeResponse,
  CardManagementInterface,
  CardPartnerBalanceResponse,
  CardPinResponse,
  CardProvider,
  CardResponse,
  CardSecretsResponse,
  CardUserBalanceResponse,
  CreateCardRequest,
  CreateCardUserRequest,
  CreatedCardUserResponse,
  DocumentUploadRequest,
  ListCardsRequest,
  ListCardsResponse,
  Occupation,
  ProcessorDetailsResponse,
  UpdateCardPinResponse,
  UpdateCardRequest,
  UpdateCardUserRequest,
} from './card.adapter.interface';
import { RainAdapter } from './rain/rain.adapter';
import { RainContractResponse, RainDisputeResponse } from './rain/rain.interface';

@Injectable()
export class CardAdapter implements CardManagementInterface {
  @Inject(RainAdapter)
  private readonly rainAdapter: RainAdapter;

  private readonly logger = new Logger(CardAdapter.name);
  private readonly cardConfig: CardConfig;

  constructor() {
    this.cardConfig = new CardConfigProvider().getConfig();
  }

  async createCardUser(cardUser: CreateCardUserRequest): Promise<CreatedCardUserResponse> {
    return await this.getProvider().createCardUser(cardUser);
  }

  async updateCardUser(cardUser: UpdateCardUserRequest): Promise<CreatedCardUserResponse> {
    return await this.getProvider().updateCardUser(cardUser);
  }

  async uploadCardUserDocument(proverUserRef: string, document: DocumentUploadRequest): Promise<Record<string, any>> {
    return await this.getProvider().uploadCardUserDocument(proverUserRef, document);
  }

  async getCardApplicationStatus(proverUserRef: string): Promise<CardApplicationStatusResponse> {
    return await this.getProvider().getCardApplicationStatus(proverUserRef);
  }

  async getUserBalance(proverUserRef: string): Promise<CardUserBalanceResponse> {
    return await this.getProvider().getUserBalance(proverUserRef);
  }

  async getPartnerBalance(): Promise<CardPartnerBalanceResponse> {
    return await this.getProvider().getPartnerBalance();
  }

  async createCard(cardRequest: CreateCardRequest): Promise<CardResponse> {
    return await this.getProvider().createCard(cardRequest);
  }

  async getCardDetails(cardId: string): Promise<CardResponse> {
    return await this.getProvider().getCardDetails(cardId);
  }

  async getDecryptedCardSecrets(cardId: string): Promise<CardSecretsResponse> {
    return await this.getProvider().getDecryptedCardSecrets(cardId);
  }

  async getCardPin(cardId: string): Promise<CardPinResponse> {
    return await this.getProvider().getCardPin(cardId);
  }

  async getProcessorDetails(cardId: string): Promise<ProcessorDetailsResponse> {
    return await this.getProvider().getProcessorDetails(cardId);
  }

  async listCards(request: ListCardsRequest): Promise<ListCardsResponse> {
    return await this.getProvider().listCards(request);
  }

  async updateCard(cardId: string, updateRequest: UpdateCardRequest): Promise<CardResponse> {
    return await this.getProvider().updateCard(cardId, updateRequest);
  }

  async updateCardPin(cardId: string, pin: string): Promise<UpdateCardPinResponse> {
    return await this.getProvider().updateCardPin(cardId, pin);
  }

  getProvider() {
    const provider = this.cardConfig.default_card_provider;
    this.logger.debug(`Selected card provider: ${provider}`);

    switch (provider) {
      case CardProvider.RAIN:
        this.logger.log('Using Rain card provider');
        return this.rainAdapter;

      default:
        this.logger.error(`Unsupported card provider: ${provider}`);
        throw new InternalServerErrorException(`Unsupported card provider: ${provider}`);
    }
  }

  public getOccupations(): Promise<Occupation[]> {
    return this.getProvider().getOccupations();
  }

  async createCharge(userId: string, amount: number, description: string): Promise<CardChargeResponse> {
    return await this.getProvider().createCharge(userId, amount, description);
  }

  /**
   * Gets user contracts from the card provider
   * Currently only supported for Rain provider
   */
  async getUserContracts(userId: string): Promise<RainContractResponse[]> {
    const provider = this.getProvider();
    if (provider instanceof RainAdapter) {
      return await provider.getUserContracts(userId);
    }
    throw new InternalServerErrorException('getUserContracts is only supported for Rain provider');
  }

  /**
   * Creates a user contract with the card provider
   * Currently only supported for Rain provider
   */
  async createUserContract(userId: string, chainId: number): Promise<RainContractResponse> {
    const provider = this.getProvider();
    if (provider instanceof RainAdapter) {
      return await provider.createUserContract(userId, chainId);
    }
    throw new InternalServerErrorException('createUserContract is only supported for Rain provider');
  }

  async createDispute(transactionId: string, textEvidence?: string): Promise<RainDisputeResponse> {
    const provider = this.getProvider();
    if (provider instanceof RainAdapter) {
      return await provider.createDispute(transactionId, textEvidence);
    }
    throw new InternalServerErrorException('createDispute is only supported for Rain provider');
  }
}
