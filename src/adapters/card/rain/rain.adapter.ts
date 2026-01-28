import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import {
  CardApplicationStatusResponse,
  CardChargeResponse,
  CardLimitFrequency,
  CardManagementInterface,
  CardPartnerBalanceResponse,
  CardPinResponse,
  CardResponse,
  CardSecretsResponse,
  CardStatus,
  CardType,
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
} from '../card.adapter.interface';
import { RainAxiosHelper } from './rain.axios-helper';
import { RainHelper } from './rain.helper';
import {
  RainApplicationStatus,
  RainApplicationStatusResponse,
  RainCardPinResponse,
  RainCardResponse,
  RainCardSecretsResponse,
  RainCreateCardRequest,
  RainCreateCardUserRequest,
  RainCreatedCardUserResponse,
  RainCreateChargeRequest,
  RainChargeResponse,
  RainCreateContractRequest,
  RainContractResponse,
  RainCreateDisputeRequest,
  RainDisputeResponse,
  RainDocumentSide,
  RainDocumentType,
  RainDocumentUploadRequest,
  RainProcessorDetailsResponse,
  RainUpdateCardPinRequest,
  RainUpdateCardRequest,
  RainUpdateCardUserRequest,
  RainUserBalanceResponse,
  COUNTRY_NAME_TO_ISO2,
} from './rain.interface';
import { RainOccupations } from './rain.occupations';
import { RainOccupationMapperService } from './rain.occupation-mapper';

@Injectable()
export class RainAdapter extends RainAxiosHelper implements CardManagementInterface {
  private readonly logger = new Logger(RainAdapter.name);

  @Inject(RainHelper)
  private readonly rainHelper: RainHelper;

  @Inject(RainOccupationMapperService)
  private readonly occupationMapper: RainOccupationMapperService;

  /**
   * Creates a new card user application with Rain
   *
   * Submits user information, compliance data, and wallet details to create a card user
   * application. The user must complete additional verification steps through the provided
   * application completion link.
   *
   * @param cardUser Card user creation request containing personal and financial information
   *
   * @returns Created card user response with provider reference and application status
   *
   * @throws When API request fails or user creation is rejected
   */
  async createCardUser(cardUser: CreateCardUserRequest): Promise<CreatedCardUserResponse> {
    this.logger.log(`Creating card user for user ${cardUser.proverUserRef}`);
    const mappedOccupation = this.occupationMapper.mapOccupation(cardUser.occupation);
    this.logger.log(`Mapped occupation: ${mappedOccupation}`);

    try {
      const requestPayload: RainCreateCardUserRequest = {
        accountPurpose: cardUser.cardUsageReason,
        annualSalary: cardUser.salary.toString(),
        occupation: mappedOccupation,
        ipAddress: cardUser.ipAddress,
        sourceKey: cardUser.proverUserRef,
        sumsubShareToken: cardUser.complianceToken,
        walletAddress: cardUser.cardStablecoinUserAddress?.walletAddress,
        isTermsOfServiceAccepted: cardUser.isTermAccepted,
        hasExistingDocuments: cardUser.useComplianceDocuments,
        expectedMonthlyVolume: cardUser.expectedMonthlySpend.toString(),
        email: cardUser.email,
        solanaAddress: cardUser.cardStablecoinUserAddress?.solanaAddress,
        tronAddress: cardUser.cardStablecoinUserAddress?.tronAddress,
        chainId: cardUser.cardStablecoinUserAddress?.chainId,
        contractAddress: cardUser.cardStablecoinUserAddress?.contractAddress,
        phoneNumber: cardUser.phoneNumber?.replace(/^\+/, ''),
      };

      this.logger.log(`Create card user request payload: ${JSON.stringify(requestPayload)}`);

      const response = await this.post<RainCreateCardUserRequest, RainCreatedCardUserResponse>(
        '/issuing/applications/user',
        requestPayload,
      );

      if (response.status !== 200) {
        this.logger.error(`Failed to create card user for user ${cardUser.proverUserRef}: ${response.data}`);
        throw new BadRequestException(
          `Failed to create card user for user ${cardUser.proverUserRef}: ${response.data}`,
        );
      }

      const responseData = response.data;
      const createdCardUser: CreatedCardUserResponse = {
        providerRef: responseData.id,
        providerParentRef: responseData.companyId,
        status: responseData.applicationStatus,
        isTermAccepted: responseData.isTermsOfServiceAccepted,
        pendingActions: [responseData.applicationCompletionLink],
        isActive: responseData.applicationStatus.toLowerCase() === RainApplicationStatus.APPROVED,
        applicationStatusReason: responseData.applicationReason,
      };

      return createdCardUser;
    } catch (error) {
      this.logger.error(`Error creating card user for user ${cardUser.proverUserRef}`, error.response?.data?.message);
      throw new BadRequestException('Failed to validate user for card creation');
    }
  }

  /**
   * Updates an existing card user application with Rain
   *
   * Modifies user information for an existing application, including personal details,
   * financial information, and address. Only provided fields will be updated.
   *
   * @param cardUser Card user update request containing fields to modify
   *
   * @returns Updated card user response with current application status
   *
   * @throws When API request fails or update is rejected
   */
  async updateCardUser(cardUser: UpdateCardUserRequest): Promise<CreatedCardUserResponse> {
    this.logger.log(`Updating card user`);
    try {
      const requestPayload: RainUpdateCardUserRequest = {
        accountPurpose: cardUser.cardUsageReason,
        annualSalary: cardUser.salary?.toString(),
        occupation: cardUser.occupation,
        ipAddress: cardUser.ipAddress,
        isTermsOfServiceAccepted: cardUser.isTermAccepted,
        hasExistingDocuments: cardUser.useComplianceDocuments,
        expectedMonthlyVolume: cardUser.expectedMonthlySpend?.toString(),
      };

      // Only include address if it's provided
      if (cardUser.cardUserAddress) {
        requestPayload.address = {
          line1: cardUser.cardUserAddress.line1,
          line2: cardUser.cardUserAddress.line2,
          city: cardUser.cardUserAddress.city,
          region: cardUser.cardUserAddress.region,
          postalCode: cardUser.cardUserAddress.postalCode,
          countryCode: cardUser.cardUserAddress.countryCode,
          country: cardUser.cardUserAddress.country,
        };
      }

      const response = await this.patch<RainUpdateCardUserRequest, RainCreatedCardUserResponse>(
        `/issuing/applications/user/${cardUser.proverUserRef}`,
        requestPayload,
      );

      if (response.status !== 200) {
        throw new BadRequestException(`Failed to update card user: ${response.data}`);
      }

      const responseData = response.data;
      const updatedCardUser: CreatedCardUserResponse = {
        providerRef: responseData.id,
        providerParentRef: responseData.companyId,
        status: responseData.applicationStatus,
        isTermAccepted: responseData.isTermsOfServiceAccepted,
        pendingActions: [responseData.applicationCompletionLink],
        isActive: responseData.applicationStatus.toLowerCase() === RainApplicationStatus.APPROVED,
        applicationStatusReason: responseData.applicationReason,
      };

      return updatedCardUser;
    } catch (error) {
      this.logger.error(`Error updating card user`, error);
      throw new BadRequestException('Failed to update card user');
    }
  }

  /**
   * Uploads identity or verification documents for a card user
   *
   * Submits document files (ID cards, passports, utility bills, etc.) for KYC verification.
   * Supports various document types and sides (front/back) as required by Rain's compliance.
   *
   * @param proverUserRef Provider user reference ID for the card user
   * @param document Document upload request containing file and metadata
   *
   * @returns Upload response with document processing details
   *
   * @throws When document upload fails or document type is invalid
   */
  async uploadCardUserDocument(proverUserRef: string, document: DocumentUploadRequest): Promise<Record<string, any>> {
    this.logger.log(`Uploading document for user ${proverUserRef}`);
    try {
      // Map string type to Rain enum
      const rainDocumentType = this.mapDocumentType(document.documentType);
      const rainDocumentSide = this.mapDocumentSide(document.documentSide);

      const requestPayload: RainDocumentUploadRequest = {
        name: document.documentName,
        type: rainDocumentType,
        side: rainDocumentSide,
        country: document.country,
        document: document.file,
      };

      const response = await this.post<RainDocumentUploadRequest, Record<string, any>>(
        `/issuing/applications/user/${proverUserRef}/document`,
        requestPayload,
        {
          'Content-Type': 'multipart/form-data',
        },
      );

      if (response.status !== 200) {
        throw new BadRequestException(`Failed to upload document for user ${proverUserRef}: ${response.data}`);
      }

      return response.data;
    } catch (error) {
      this.logger.error(`Error uploading document for user ${proverUserRef}`, error);
      throw new BadRequestException('Failed to upload document');
    }
  }

  /**
   * Retrieves the current application status for a card user
   *
   * Fetches the latest status of a user's card application, including approval status,
   * pending actions, and completion links for additional verification steps.
   *
   * @param proverUserRef Provider user reference ID for the card user
   *
   * @returns Application status response with current state and next steps
   *
   * @throws When API request fails or user reference is invalid
   */
  async getCardApplicationStatus(proverUserRef: string): Promise<CardApplicationStatusResponse> {
    this.logger.log(`Getting card application status for user ${proverUserRef}`);
    try {
      const response = await this.get<RainApplicationStatusResponse>(`/issuing/applications/user/${proverUserRef}`);

      if (response.status !== 200) {
        throw new BadRequestException(
          `Failed to get card application status for user ${proverUserRef}: ${response.data}`,
        );
      }

      const responseData = response.data;
      const status: CardApplicationStatusResponse = {
        providerRef: responseData.id,
        status: responseData.applicationStatus,
        isActive: responseData.applicationStatus.toLowerCase() === RainApplicationStatus.APPROVED,
        applicationCompletionLink: responseData.applicationCompletionLink,
        applicationReason: responseData.applicationReason,
      };

      return status;
    } catch (error) {
      this.logger.error(`Error getting card application status for user ${proverUserRef}`, error);
      throw new BadRequestException('Failed to get card application status');
    }
  }

  /**
   * Retrieves current balance information for a specific card user
   *
   * Fetches detailed balance data including credit limit, pending charges, posted charges,
   * balance due, and available spending power for the specified user.
   *
   * @param proverUserRef Provider user reference ID for the card user
   *
   * @returns User balance response with detailed financial information
   *
   * @throws When API request fails or user reference is invalid
   */
  async getUserBalance(proverUserRef: string): Promise<CardUserBalanceResponse> {
    this.logger.log(`Getting user balance for user ${proverUserRef}`);
    try {
      const response = await this.get<RainUserBalanceResponse>(`/issuing/users/${proverUserRef}/balances`);

      if (response.status !== 200) {
        throw new BadRequestException(`Failed to get user balance for user ${proverUserRef}: ${response.data}`);
      }

      const responseData = response.data;
      const balance: CardUserBalanceResponse = {
        creditLimit: responseData.creditLimit,
        pendingCharges: responseData.pendingCharges,
        postedCharges: responseData.postedCharges,
        balanceDue: responseData.balanceDue,
        spendingPower: responseData.spendingPower,
      };

      return balance;
    } catch (error) {
      this.logger.error(`Error getting user balance for user ${proverUserRef}`, error);
      throw new BadRequestException('Failed to get user balance');
    }
  }

  /**
   * Retrieves current balance information for the partner account
   *
   * Fetches aggregate balance data for the entire partner account, including total
   * credit limits, charges, and spending power across all users.
   *
   * @returns Partner balance response with aggregate financial information
   *
   * @throws When API request fails or partner access is denied
   */
  async getPartnerBalance(): Promise<CardPartnerBalanceResponse> {
    this.logger.log(`Getting partner balance`);
    try {
      const response = await this.get<RainUserBalanceResponse>(`/issuing/balances`);

      if (response.status !== 200) {
        throw new BadRequestException(`Failed to get partner balance: ${response.data}`);
      }

      const responseData = response.data;
      const balance: CardPartnerBalanceResponse = {
        creditLimit: responseData.creditLimit,
        pendingCharges: responseData.pendingCharges,
        postedCharges: responseData.postedCharges,
        balanceDue: responseData.balanceDue,
        spendingPower: responseData.spendingPower,
      };

      return balance;
    } catch (error) {
      this.logger.error(`Error getting partner balance`, error);
      throw new BadRequestException('Failed to get partner balance');
    }
  }

  /**
   * Creates a new virtual or physical card for a user
   *
   * Issues a new card with specified type, limits, billing address, and configuration.
   * Physical cards require shipping address and method, while virtual cards are issued
   * immediately without shipping requirements.
   *
   * @param cardRequest Card creation request with type, limits, and address details
   *
   * @returns Created card response with card details and provider metadata
   *
   * @throws When card creation fails, validation errors, or insufficient user status
   *
   * @example
   * // Create a virtual card
   * const card = await createCard({
   *   type: CardType.VIRTUAL,
   *   providerUserRef: "user123",
   *   limit: { amount: 1000, frequency: "monthly" }
   * });
   */
  async createCard(cardRequest: CreateCardRequest): Promise<CardResponse> {
    this.logger.log(`Creating ${cardRequest.type} card`);
    try {
      // Validate card type specific requirements
      this.validateCardRequest(cardRequest);

      const requestPayload = this.buildCreateCardPayload(cardRequest);

      const response = await this.post<RainCreateCardRequest, RainCardResponse>(
        `/issuing/users/${cardRequest.providerUserRef}/cards`,
        requestPayload,
      );

      if (response.status !== 200 && response.status !== 201) {
        throw new BadRequestException(`Failed to create ${cardRequest.type} card: ${response.data}`);
      }

      const responseData = response.data;
      const createdCard: CardResponse = {
        cardId: responseData.id,
        type: responseData.type as CardType,
        status: responseData.status as CardStatus,
        isActive: responseData.status.toLowerCase() === CardStatus.ACTIVE,
        displayName: `${cardRequest.firstName} ${cardRequest.lastName}`,
        lastFourDigits: responseData.last4,
        expiryMonth: responseData.expirationMonth,
        expiryYear: responseData.expirationYear,
        limitAmount: responseData.limit.amount,
        limitFrequency: responseData.limit.frequency as CardLimitFrequency,
        providerMetadata: {
          companyId: responseData.companyId,
          userId: responseData.userId,
          tokenWallets: responseData.tokenWallets,
          requestConfiguration: cardRequest.configuration,
          requestBilling: cardRequest.billing,
          requestShipping: cardRequest.shipping,
          bulkShippGroupId: cardRequest.bulkShippGroupId,
        },
      };

      return createdCard;
    } catch (error) {
      this.logger.error(`Error creating ${cardRequest.type} card`, error);
      this.logger.error(`Error creating ${cardRequest.type} card: ${error.response?.data?.message}`);
      throw new BadRequestException(`Failed to create ${cardRequest.type} card`);
    }
  }

  /**
   * Retrieves detailed information for a specific card
   *
   * Fetches comprehensive card details from the provider including card type, status,
   * spending limits, expiration information, and metadata. This provides real-time
   * card information for display and management purposes.
   *
   * @param cardId Unique identifier for the card
   *
   * @returns Card details response with comprehensive card information
   *
   * @throws When API request fails or card ID is invalid
   */
  async getCardDetails(cardId: string): Promise<CardResponse> {
    this.logger.log(`Getting card details for card ${cardId}`);
    try {
      const response = await this.get<RainCardResponse>(`/issuing/cards/${cardId}`);

      if (response.status !== 200) {
        throw new BadRequestException(`Failed to get card details for card ${cardId}: ${response.data}`);
      }

      const responseData = response.data;
      const cardDetails: CardResponse = {
        cardId: responseData.id,
        type: responseData.type as CardType,
        status: responseData.status as CardStatus,
        isActive: responseData.status.toLowerCase() === CardStatus.ACTIVE,
        displayName: `Card ${responseData.last4}`, // Generic display name since we don't have user names
        lastFourDigits: responseData.last4,
        expiryMonth: responseData.expirationMonth,
        expiryYear: responseData.expirationYear,
        limitAmount: responseData.limit.amount,
        limitFrequency: responseData.limit.frequency as CardLimitFrequency,
        providerMetadata: {
          companyId: responseData.companyId,
          userId: responseData.userId,
          tokenWallets: responseData.tokenWallets,
        },
      };

      return cardDetails;
    } catch (error) {
      this.logger.error(`Error getting card details for card ${cardId}`, error);
      this.logger.error(`Error getting card details for card: ${error.response?.data?.message}`);
      throw new BadRequestException(`Failed to get card details for card`);
    }
  }

  /**
   * Retrieves encrypted sensitive card data (PAN and CVC)
   *
   * Fetches encrypted card secrets from Rain including the full card number (PAN)
   * and card verification code (CVC). The data is returned in encrypted format
   * with initialization vectors for secure client-side decryption.
   *
   * Security Note: This endpoint returns highly sensitive financial data that must
   * be handled with extreme care. The encrypted data should only be decrypted
   * in secure, authorized contexts.
   *
   * @param cardId Unique identifier for the card
   *
   * @returns Encrypted card secrets response with PAN and CVC data
   *
   * @throws When API request fails, card ID is invalid, or insufficient permissions
   */
  async getDecryptedCardSecrets(cardId: string): Promise<CardSecretsResponse> {
    this.logger.log(`Getting encrypted card secrets for card ${cardId}`);
    try {
      const { sessionId } = await this.rainHelper.generateSessionId();
      const response = await this.get<RainCardSecretsResponse>(`/issuing/cards/${cardId}/secrets`, undefined, {
        sessionid: sessionId,
      });

      if (response.status !== 200) {
        throw new BadRequestException(`Failed to get card secrets for card ${cardId}: ${response.data}`);
      }

      const responseData = response.data;

      const decryptedPan = await this.rainHelper.decryptSecret(
        responseData.encryptedPan.data,
        responseData.encryptedPan.iv,
      );

      const decryptedCvc = await this.rainHelper.decryptSecret(
        responseData.encryptedCvc.data,
        responseData.encryptedCvc.iv,
      );

      const cardSecrets: CardSecretsResponse = {
        decryptedPan,
        decryptedCvc,
      };

      return cardSecrets;
    } catch (error) {
      this.logger.error(`Error getting card secrets for card ${cardId}`, error);
      this.logger.error(`Error getting card secrets for card: ${error.response?.data?.message}`);
      throw new BadRequestException(`Failed to get card secrets for card`);
    }
  }

  /**
   * Retrieves encrypted card PIN data
   *
   * Fetches encrypted card PIN from Rain including initialization vector for
   * secure client-side decryption. This endpoint requires special session-based
   * authorization and returns highly sensitive PIN data.
   *
   * Security Note: This endpoint returns highly sensitive PIN data that must
   * be handled with extreme care. The encrypted data should only be decrypted
   * in secure, authorized contexts and requires a valid session ID.
   *
   * @param cardId Unique identifier for the card
   *
   * @returns Encrypted card PIN response with PIN data and IV
   *
   * @throws When API request fails, card ID is invalid, session is invalid, or insufficient permissions
   */
  async getCardPin(cardId: string): Promise<CardPinResponse> {
    this.logger.log(`Getting encrypted card PIN for card ${cardId}`);
    try {
      const { sessionId } = await this.rainHelper.generateSessionId();
      const response = await this.get<RainCardPinResponse>(`/cards/${cardId}/pin`, undefined, {
        sessionid: sessionId,
      });

      if (response.status !== 200) {
        throw new BadRequestException(`Failed to get card PIN for card ${cardId}: ${response.data}`);
      }

      const responseData = response.data;
      const cardPin: CardPinResponse = {
        encryptedPin: {
          iv: responseData.encryptedPin.iv,
          data: responseData.encryptedPin.data,
        },
      };

      return cardPin;
    } catch (error) {
      this.logger.error(`Error getting card PIN for card ${cardId}`, error);
      this.logger.error(`Error getting card PIN for card: ${error.response?.data?.message}`);
      throw new BadRequestException(`Failed to get card PIN for card`);
    }
  }

  /**
   * Retrieves processor-specific details for a card
   *
   * Fetches processor-related information from Rain including processor card ID
   * and time-based secret. This information is used for integration with payment
   * processors and transaction routing systems.
   *
   * @param cardId Unique identifier for the card
   *
   * @returns Processor details response with processor card ID and time-based secret
   *
   * @throws When API request fails, card ID is invalid, or insufficient permissions
   */
  async getProcessorDetails(cardId: string): Promise<ProcessorDetailsResponse> {
    this.logger.log(`Getting processor details for card ${cardId}`);
    try {
      const response = await this.get<RainProcessorDetailsResponse>(`/issuing/cards/${cardId}/processorDetails`);

      if (response.status !== 200) {
        throw new BadRequestException(`Failed to get processor details for card ${cardId}: ${response.data}`);
      }

      const responseData = response.data;
      const processorDetails: ProcessorDetailsResponse = {
        processorCardId: responseData.processorCardId,
        timeBasedSecret: responseData.timeBasedSecret,
      };

      return processorDetails;
    } catch (error) {
      this.logger.error(`Error getting processor details for card ${cardId}`, error);
      throw new BadRequestException(
        error.response?.data?.message || `Failed to get processor details for card ${cardId}`,
      );
    }
  }

  /**
   * Retrieves multiple cards with filtering and pagination support
   *
   * Fetches a list of cards from Rain with support for filtering by user ID and status,
   * plus cursor-based pagination for efficient data retrieval. The response includes
   * the standard card information for each card and pagination metadata.
   *
   * @param request List cards request with filtering and pagination parameters
   *
   * @returns Paginated list of cards response with card details and pagination metadata
   *
   * @throws When API request fails, request parameters are invalid, or insufficient permissions
   */
  async listCards(request: ListCardsRequest): Promise<ListCardsResponse> {
    this.logger.log(`Listing cards for user ${request.userId}`);
    try {
      // Build query parameters
      const queryParams: Record<string, string> = {
        userId: request.userId,
      };

      if (request.status) {
        queryParams.status = request.status;
      }

      if (request.cursor) {
        queryParams.cursor = request.cursor;
      }

      if (request.limit) {
        queryParams.limit = request.limit.toString();
      }

      // Convert query params to URL search string
      const searchParams = new URLSearchParams(queryParams);
      const endpoint = `/issuing/cards?${searchParams.toString()}`;

      const response = await this.get<RainCardResponse[]>(endpoint);

      if (response.status !== 200) {
        throw new BadRequestException(`Failed to list cards for user ${request.userId}: ${response.data}`);
      }

      const responseData = response.data;

      // Transform each card to the standardized format
      const cards: CardResponse[] = responseData.map((rainCard) => ({
        cardId: rainCard.id,
        type: rainCard.type as CardType,
        status: rainCard.status as CardStatus,
        isActive: rainCard.status.toLowerCase() === CardStatus.ACTIVE,
        displayName: `Card ${rainCard.last4}`,
        lastFourDigits: rainCard.last4,
        expiryMonth: rainCard.expirationMonth,
        expiryYear: rainCard.expirationYear,
        limitAmount: rainCard.limit.amount,
        limitFrequency: rainCard.limit.frequency as CardLimitFrequency,
        providerMetadata: {
          companyId: rainCard.companyId,
          userId: rainCard.userId,
          tokenWallets: rainCard.tokenWallets,
        },
      }));

      const listCardsResponse: ListCardsResponse = {
        cards,
        // Note: Rain API response structure may include pagination metadata
        // These would need to be extracted from response headers or response body
        // depending on Rain's actual API implementation
        nextCursor: response.headers?.['x-next-cursor'] as string,
        hasMore: response.headers?.['x-has-more'] === 'true',
      };

      return listCardsResponse;
    } catch (error) {
      this.logger.error(`Error listing cards for user ${request.userId}`, error);
      throw new BadRequestException(`Failed to list cards for user ${request.userId}`);
    }
  }

  /**
   * Updates an existing card's configuration and limits
   *
   * Modifies card settings including spending limits, billing address, and virtual card
   * artwork. Only provided fields will be updated while others remain unchanged.
   *
   * @param cardId Unique identifier for the card to update
   * @param updateRequest Card update request containing fields to modify
   *
   * @returns Updated card response with current configuration
   *
   * @throws When card update fails or card ID is invalid
   */
  async updateCard(cardId: string, updateRequest: UpdateCardRequest): Promise<CardResponse> {
    this.logger.log(`Updating card ${cardId}`);
    try {
      const requestPayload: RainUpdateCardRequest = {};

      // Add limit if provided
      if (updateRequest.limit) {
        requestPayload.limit = {
          frequency: updateRequest.limit.frequency,
          amount: updateRequest.limit.amount,
        };
      }

      // Add billing if provided
      if (updateRequest.billing) {
        requestPayload.billing = {
          line1: updateRequest.billing.line1,
          line2: updateRequest.billing.line2,
          city: updateRequest.billing.city,
          region: updateRequest.billing.region,
          postalCode: updateRequest.billing.postalCode,
          countryCode: updateRequest.billing.countryCode,
          country: updateRequest.billing.country,
        };
      }

      // Add configuration if provided
      if (updateRequest.configuration?.virtualCardArt) {
        requestPayload.configuration = {
          virtualCardArt: updateRequest.configuration.virtualCardArt,
        };
      }

      // Add status if provided
      if (updateRequest.status) {
        requestPayload.status = updateRequest.status;
      }

      const response = await this.patch<RainUpdateCardRequest, RainCardResponse>(
        `/issuing/cards/${cardId}`,
        requestPayload,
      );

      if (response.status !== 200) {
        throw new BadRequestException(`Failed to update card ${cardId}: ${response.data}`);
      }

      const responseData = response.data;

      const updatedCard: CardResponse = {
        cardId: responseData.id,
        type: responseData.type as CardType,
        status: responseData.status as CardStatus,
        isActive: responseData.status.toLowerCase() === CardStatus.ACTIVE,
        displayName: `${updateRequest.firstName} ${updateRequest.lastName}`,
        lastFourDigits: responseData.last4,
        expiryMonth: responseData.expirationMonth,
        expiryYear: responseData.expirationYear,
        limitAmount: responseData.limit.amount,
        limitFrequency: responseData.limit.frequency as CardLimitFrequency,
        providerMetadata: {
          companyId: responseData.companyId,
          userId: responseData.userId,
          tokenWallets: responseData.tokenWallets,
          updateRequestData: updateRequest,
        },
      };

      return updatedCard;
    } catch (error) {
      this.logger.error(`Error updating card ${cardId}`, error);
      this.logger.error(`Error updating card: ${error.response?.data?.message}`);
      throw new BadRequestException(`Failed to update card`);
    }
  }

  /**
   * Updates the PIN for a card using encrypted transmission
   *
   * Encrypts the new PIN using Rain's security protocol (ISO format PIN block with AES-GCM)
   * and securely transmits it to update the card's PIN. The PIN is never sent in plain text.
   *
   * @param cardId Unique identifier for the card
   * @param pin New PIN for the card (numeric string)
   *
   * @returns Update response with encrypted PIN confirmation
   *
   * @throws When PIN update fails, encryption errors, or card ID is invalid
   */
  async updateCardPin(cardId: string, pin: string): Promise<UpdateCardPinResponse> {
    this.logger.log(`Updating card pin for card ${cardId}`);
    try {
      const { encryptedPin, encodedIv, sessionId } = await this.rainHelper.encryptCardPin(pin);

      const requestPayload: RainUpdateCardPinRequest = {
        encryptedPin: {
          iv: encodedIv,
          data: encryptedPin,
        },
      };

      const response = await this.patch<RainUpdateCardPinRequest, any>(`/issuing/cards/${cardId}/pin`, requestPayload, {
        SessionId: sessionId,
      });

      if (response.status !== 200) {
        throw new BadRequestException(`Failed to update card pin for card ${cardId}: ${response.data}`);
      }

      return {
        encryptedPin: response.data.data,
        encodedIv: response.data.iv,
      };
    } catch (error) {
      this.logger.error(`Error updating card pin for card ${cardId}`, error);
      this.logger.error(`Error updating card pin for card: ${error.response?.data?.message}`);
      throw new BadRequestException(`Failed to update card pin for card`);
    }
  }

  /**
   * Validates card creation request based on card type requirements
   *
   * Ensures that physical cards have required shipping information and phone numbers,
   * while virtual cards don't include unnecessary shipping data. Prevents common
   * validation errors before API submission.
   *
   * @param cardRequest Card creation request to validate
   *
   * @throws When validation fails for card type specific requirements
   */
  private validateCardRequest(cardRequest: CreateCardRequest): void {
    if (cardRequest.type === CardType.PHYSICAL) {
      // Physical cards require shipping address
      if (!cardRequest.shipping) {
        throw new BadRequestException('Shipping address is required for physical cards');
      }

      // Validate shipping method
      if (!cardRequest.shipping.method) {
        throw new BadRequestException('Shipping method is required for physical cards');
      }

      // Validate phone number for shipping
      if (!cardRequest.shipping.phoneNumber) {
        throw new BadRequestException('Phone number is required for physical card shipping');
      }
    } else if (cardRequest.type === CardType.VIRTUAL) {
      // Virtual cards should not have shipping information
      if (cardRequest.shipping) {
        throw new BadRequestException('Shipping address should not be provided for virtual cards');
      }

      // Virtual cards should not have bulk shipping group ID
      if (cardRequest.bulkShippGroupId) {
        throw new BadRequestException('Bulk shipping group ID should not be provided for virtual cards');
      }
    }
  }

  /**
   * Maps generic document type strings to Rain-specific document type enums
   *
   * Converts common document type identifiers to Rain's internal enum values,
   * supporting various identity documents, utility bills, and verification files.
   *
   * @param type Generic document type string identifier
   *
   * @returns Rain document type enum value
   */
  private mapDocumentType(type: string): RainDocumentType {
    const typeMapping: Record<string, RainDocumentType> = {
      idCard: RainDocumentType.ID_CARD,
      passport: RainDocumentType.PASSPORT,
      drivers: RainDocumentType.DRIVERS,
      residencePermit: RainDocumentType.RESIDENCE_PERMIT,
      utilityBill: RainDocumentType.UTILITY_BILL,
      selfie: RainDocumentType.SELFIE,
      videoSelfie: RainDocumentType.VIDEO_SELFIE,
      profileImage: RainDocumentType.PROFILE_IMAGE,
      idDocPhoto: RainDocumentType.ID_DOC_PHOTO,
      agreement: RainDocumentType.AGREEMENT,
      contract: RainDocumentType.CONTRACT,
      driversTranslation: RainDocumentType.DRIVERS_TRANSLATION,
      investorDoc: RainDocumentType.INVESTOR_DOC,
      vehicleRegistrationCertificate: RainDocumentType.VEHICLE_REGISTRATION_CERTIFICATE,
      incomeSource: RainDocumentType.INCOME_SOURCE,
      paymentMethod: RainDocumentType.PAYMENT_METHOD,
      bankCard: RainDocumentType.BANK_CARD,
      covidVaccinationForm: RainDocumentType.COVID_VACCINATION_FORM,
      other: RainDocumentType.OTHER,
    };

    return typeMapping[type] || RainDocumentType.OTHER;
  }

  /**
   * Maps generic document side strings to Rain-specific document side enums
   *
   * Converts document side identifiers (front/back) to Rain's internal enum values
   * for proper document orientation handling during KYC verification.
   *
   * @param side Generic document side string (front/back)
   *
   * @returns Rain document side enum value
   */
  private mapDocumentSide(side: string): RainDocumentSide {
    const sideMapping: Record<string, RainDocumentSide> = {
      front: RainDocumentSide.FRONT,
      back: RainDocumentSide.BACK,
    };

    return sideMapping[side] || RainDocumentSide.FRONT;
  }

  /**
   * Builds the request payload for creating a card
   *
   * @param cardRequest The card creation request
   * @returns The formatted payload for Rain API
   */
  private buildCreateCardPayload(cardRequest: CreateCardRequest): RainCreateCardRequest {
    this.logger.log(`Building create card payload for card request: ${JSON.stringify(cardRequest)}`);
    // Validate and set countryCode based on billing country
    const validatedCountryCode = this.validateAndSetCountryCode(
      cardRequest.billing.countryCode,
      cardRequest.billing.country,
    );

    const requestPayload: RainCreateCardRequest = {
      type: cardRequest.type,
      limit: {
        frequency: cardRequest.limit.frequency,
        amount: cardRequest.limit.amount,
      },
      billing: {
        line1: cardRequest.billing.line1,
        line2: cardRequest.billing.line2,
        city: cardRequest.billing.city,
        region: cardRequest.billing.region,
        postalCode: cardRequest.billing.postalCode,
        countryCode: validatedCountryCode,
        country: cardRequest.billing.country,
      },
      status: cardRequest.status,
    };

    if (cardRequest.configuration) {
      requestPayload.configuration = {
        displayName: `${cardRequest.firstName} ${cardRequest.lastName}`,
        productId: cardRequest.configuration.productId,
        productRef: cardRequest.configuration.productRef,
        virtualCardArt: cardRequest.configuration.virtualCardArt,
      };
    }

    // Add shipping for physical cards
    if (cardRequest.type === CardType.PHYSICAL && cardRequest.shipping) {
      // Validate and set countryCode for shipping address
      const validatedShippingCountryCode = this.validateAndSetCountryCode(
        cardRequest.shipping.countryCode,
        cardRequest.shipping.country,
      );

      requestPayload.shipping = {
        line1: cardRequest.shipping.line1,
        line2: cardRequest.shipping.line2,
        city: cardRequest.shipping.city,
        region: cardRequest.shipping.region,
        postalCode: cardRequest.shipping.postalCode,
        countryCode: validatedShippingCountryCode,
        country: cardRequest.shipping.country,
        phoneNumber: cardRequest.shipping.phoneNumber,
        method: cardRequest.shipping.method,
      };
    }

    // Add bulk shipping group ID for physical cards if provided
    if (cardRequest.type === CardType.PHYSICAL && cardRequest.bulkShippGroupId) {
      requestPayload.bulkShippingGroupId = cardRequest.bulkShippGroupId;
    }

    return requestPayload;
  }

  /**
   * Validates and sets the correct country code based on the billing country
   *
   * @param countryCode The provided country code
   * @param country The country name
   * @returns Validated and corrected country code
   */
  private validateAndSetCountryCode(countryCode: string, country: string): string {
    // If countryCode is already valid (2-letter ISO code), use it
    if (countryCode?.length === 2 && /^[A-Z]{2}$/.test(countryCode)) {
      return countryCode.toUpperCase();
    }

    // If countryCode is not valid, try to derive it from country name
    if (country) {
      const mappedCode = COUNTRY_NAME_TO_ISO2[country];
      if (mappedCode) {
        this.logger.log(`Mapped country "${country}" to country code "${mappedCode}"`);
        return mappedCode;
      }
    }

    // Default to US if no valid mapping found
    this.logger.warn(`Could not determine country code for "${countryCode}" or "${country}", defaulting to US`);
    return 'US';
  }

  async getOccupations(): Promise<Occupation[]> {
    return RainOccupations;
  }

  /**
   * Fetches all contracts for a user
   *
   * Retrieves a list of all contracts associated with a specific user from Rain.
   *
   * @param userId - The user ID to fetch contracts for
   * @returns Promise resolving to array of contract responses
   * @throws BadRequestException when API request fails
   */
  async getUserContracts(userId: string): Promise<RainContractResponse[]> {
    this.logger.log(`Fetching contracts for user ${userId}`);

    try {
      const response = await this.get<RainContractResponse[]>(`/issuing/users/${userId}/contracts`);

      if (response.status !== 200) {
        this.logger.error(`Failed to fetch contracts for user ${userId}: ${response.data}`);
        throw new BadRequestException(`Failed to fetch contracts for user ${userId}: ${response.data}`);
      }

      return response.data;
    } catch (error) {
      this.logger.error(`Error fetching contracts for user ${userId}`, error);
      throw new BadRequestException('Failed to fetch contracts');
    }
  }

  /**
   * Creates a new contract for a user
   *
   * Creates a new contract with the specified chain ID for a user.
   *
   * @param userId - The user ID to create contract for
   * @param chainId - The chain ID for the contract
   * @returns Promise resolving to created contract response
   * @throws BadRequestException when API request fails
   */
  async createUserContract(userId: string, chainId: number): Promise<RainContractResponse> {
    this.logger.log(`Creating contract for user ${userId} with chainId ${chainId}`);

    try {
      const requestPayload: RainCreateContractRequest = {
        chainId,
      };

      const response = await this.post<RainCreateContractRequest, RainContractResponse>(
        `/issuing/users/${userId}/contracts`,
        requestPayload,
      );

      if (response.status !== 200) {
        this.logger.error(`Failed to create contract for user ${userId}: ${response.data}`);
        throw new BadRequestException(`Failed to create contract for user ${userId}: ${response.data}`);
      }

      return response.data;
    } catch (error) {
      this.logger.error(`Error creating contract for user ${userId}`, error);
      throw new BadRequestException('Failed to create contract');
    }
  }

  async createCharge(userId: string, amount: number, description: string): Promise<CardChargeResponse> {
    this.logger.log(`Creating charge for user ${userId} with amount ${amount}`);

    try {
      const requestPayload: RainCreateChargeRequest = {
        amount,
        description,
      };

      this.logger.debug(`Rain charge request payload: ${JSON.stringify(requestPayload)}`);

      const response = await this.post<RainCreateChargeRequest, RainChargeResponse>(
        `/issuing/users/${userId}/charges`,
        requestPayload,
      );

      if (response.status !== 200 && response.status !== 201) {
        const errorDetails = JSON.stringify(response.data, null, 2);
        this.logger.error(
          `Failed to create charge for user ${userId}. Status: ${response.status}, Response: ${errorDetails}`,
        );
        throw new BadRequestException(
          `Failed to create charge for user ${userId}: ${errorDetails || JSON.stringify(response.data)}`,
        );
      }

      const responseData = response.data;
      const chargeResponse: CardChargeResponse = {
        providerRef: responseData.id,
        createdAt: responseData.createdAt,
        amount: responseData.amount,
        description: responseData.description,
      };

      return chargeResponse;
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
      const errorData = error.response?.data ? JSON.stringify(error.response.data, null, 2) : 'No error data';
      const errorStatus = error.response?.status || 'N/A';

      this.logger.error(
        `Error creating charge for user ${userId}. Status: ${errorStatus}, Message: ${errorMessage}, Data: ${errorData}`,
        error.stack || error,
      );

      throw new BadRequestException('Failed to create charge');
    }
  }

  async createDispute(transactionId: string, textEvidence?: string): Promise<RainDisputeResponse> {
    this.logger.log(`Creating dispute for transaction ${transactionId}`);

    try {
      const requestPayload: RainCreateDisputeRequest = {
        textEvidence,
      };

      this.logger.debug(`Rain dispute request payload: ${JSON.stringify(requestPayload)}`);

      const response = await this.post<RainCreateDisputeRequest, RainDisputeResponse>(
        `/issuing/transactions/${transactionId}/disputes`,
        requestPayload,
      );

      if (response.status !== 200 && response.status !== 201) {
        const errorDetails = JSON.stringify(response.data, null, 2);
        this.logger.error(
          `Failed to create dispute for transaction ${transactionId}. Status: ${response.status}, Response: ${errorDetails}`,
        );
        throw new BadRequestException(`Failed to create dispute for transaction ${transactionId}`);
      }

      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
      const errorData = error.response?.data ? JSON.stringify(error.response.data, null, 2) : 'No error data';
      const errorStatus = error.response?.status || 'N/A';

      this.logger.error(
        `Error creating dispute for transaction ${transactionId}. Status: ${errorStatus}, Message: ${errorMessage}, Data: ${errorData}`,
        error.stack || error,
      );

      throw new BadRequestException('Failed to create dispute');
    }
  }
}
