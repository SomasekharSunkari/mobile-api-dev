/**
 * Card Management Interface
 *
 * This interface defines a standardized contract for card management operations
 * across different card providers in the OneDosh cross-border payment platform.
 * It serves as an adapter layer that transforms and normalizes responses from
 * various card providers (Rain, etc.) into a consistent format.
 *
 * Purpose:
 * - Abstracts provider-specific implementations behind a unified interface
 * - Enables seamless switching between different card providers
 * - Standardizes request/response formats across all card operations
 * - Supports both physical and virtual card management workflows
 *
 * Provider Integration:
 * Each card provider implements this interface through their specific adapter,
 * allowing the OneDosh platform to support multiple card issuing partners
 * while maintaining consistent business logic and API contracts.
 *
 * Data Flow:
 * Controller → Service → Card Adapter → Provider API → Standardized Response
 *
 * @see src/adapters/card/rain/ - Rain card provider implementation
 * @see src/modules/card/ - Card management module (when implemented)
 */
export interface CardManagementInterface {
  /**
   * Creates a new card user profile with the selected card provider
   *
   * This method establishes a user account with the card provider, enabling
   * them to request physical and virtual cards. The process includes:
   * - User identity verification and compliance checks
   * - KYC/AML validation using provided compliance tokens
   * - Address verification for blockchain wallet integration
   * - Terms acceptance and risk assessment
   *
   * The response is normalized across all providers to ensure consistent
   * handling regardless of the underlying card issuer's API structure.
   *
   * @param cardUser - User information and compliance data for card registration
   * @returns Promise resolving to standardized user creation response
   * @throws CardProviderException when provider API fails
   * @throws ValidationException when required data is invalid
   */
  createCardUser(cardUser: CreateCardUserRequest): Promise<CreatedCardUserResponse>;

  /**
   * Updates an existing card user profile with the selected card provider
   *
   * This method allows updating an existing card user profile with new information.
   * It includes:
   * - Address updates for physical card delivery
   * - Risk assessment updates
   * - Terms acceptance confirmation
   *
   * @param cardUser - User information and compliance data for card registration
   * @returns Promise resolving to standardized user creation response
   * @throws CardProviderException when provider API fails
   * @throws ValidationException when required data is invalid
   */
  updateCardUser(cardUser: UpdateCardUserRequest): Promise<CreatedCardUserResponse>;

  /**
   * Uploads a document for a card user to the selected card provider
   *
   * This method allows uploading identity documents, utility bills, and other
   * required documents for KYC/AML compliance. It includes:
   * - Document validation and processing
   * - Support for different document types and sides (front/back)
   * - Country-specific document requirements
   *
   * @param proverUserRef - User's Id on provider side
   * @param document - Document information and binary file data
   * @returns Promise resolving to document upload response
   * @throws CardProviderException when provider API fails
   * @throws ValidationException when document data is invalid
   */
  uploadCardUserDocument(proverUserRef: string, document: DocumentUploadRequest): Promise<Record<string, any>>;

  /**
   * Retrieves the current status of a card application for a specific user
   *
   * This method fetches the current application status from the card provider,
   * enabling real-time tracking of application progress. It includes:
   * - Current application status (approved, pending, denied, etc.)
   * - Application completion links for additional requirements
   * - Application reason or rejection details when applicable
   *
   * @param proverUserRef - User's Id on provider side
   * @returns Promise resolving to standardized card application status response
   * @throws CardProviderException when provider API fails
   * @throws NotFoundException when user application is not found
   */
  getCardApplicationStatus(proverUserRef: string): Promise<CardApplicationStatusResponse>;

  /**
   * Retrieves the current balance information for a card user
   *
   * This method fetches the current balance and spending information from the card provider,
   * enabling real-time tracking of user's financial status. It includes:
   * - Credit limit and available spending power
   * - Posted and pending charges
   * - Balance due and outstanding amounts
   *
   * @param proverUserRef - User's Id on provider side
   * @returns Promise resolving to standardized card balance response
   * @throws CardProviderException when provider API fails
   * @throws NotFoundException when user is not found
   */
  getUserBalance(proverUserRef: string): Promise<CardUserBalanceResponse>;

  /**
   * Retrieves the current balance information for the organization's account with the card provider
   *
   * This method fetches the current balance and spending information for the organization's
   * master account with the card provider, enabling real-time tracking of the company's
   * financial status. It includes:
   * - Credit limit and available spending power
   * - Posted and pending charges
   * - Balance due and outstanding amounts
   *
   * @returns Promise resolving to standardized partner balance response
   * @throws CardProviderException when provider API fails
   * @throws AuthenticationException when organization credentials are invalid
   */
  getPartnerBalance(): Promise<CardPartnerBalanceResponse>;

  /**
   * Creates a new card (virtual or physical) for a user
   *
   * This method creates either a virtual or physical card for a user with the card provider.
   * It includes:
   * - Card type selection (virtual or physical)
   * - Spending limits and frequency controls
   * - Billing address configuration
   * - Shipping address for physical cards (required)
   * - Card display configuration
   *
   * @param cardRequest - Card creation request with type-specific configurations
   * @returns Promise resolving to standardized card creation response
   * @throws CardProviderException when provider API fails
   * @throws ValidationException when card configuration is invalid
   */
  createCard(cardRequest: CreateCardRequest): Promise<CardResponse>;

  /**
   * Retrieves detailed information for a specific card
   *
   * This method fetches comprehensive card details from the card provider including:
   * - Card type, status, and activation state
   * - Spending limits and usage information
   * - Card display details and metadata
   * - Expiration information and card identifiers
   *
   * @param cardId - Provider's unique identifier for the card
   * @returns Promise resolving to standardized card details response
   * @throws CardProviderException when provider API fails
   * @throws NotFoundException when card is not found
   */
  getCardDetails(cardId: string): Promise<CardResponse>;

  /**
   * Retrieves encrypted sensitive card data (PAN and CVC)
   *
   * This method fetches encrypted card secrets from the card provider including:
   * - Encrypted Primary Account Number (full card number)
   * - Encrypted Card Verification Code (CVC/CVV)
   * - Initialization vectors for secure decryption
   *
   * The data is returned in encrypted format with proper IV for secure client-side
   * decryption. This ensures sensitive card data is never transmitted in plain text.
   *
   * @param cardId - Provider's unique identifier for the card
   * @returns Promise resolving to encrypted card secrets response
   * @throws CardProviderException when provider API fails
   * @throws NotFoundException when card is not found
   * @throws AuthorizationException when insufficient permissions for sensitive data
   */
  getDecryptedCardSecrets(cardId: string): Promise<CardSecretsResponse>;

  /**
   * Retrieves encrypted card PIN data
   *
   * This method fetches the encrypted card PIN from the card provider including:
   * - Encrypted Personal Identification Number (PIN)
   * - Initialization vector for secure decryption
   *
   * The data is returned in encrypted format with proper IV for secure client-side
   * decryption. This ensures the PIN is never transmitted in plain text and requires
   * a valid session ID for authorization.
   *
   * Security Note: This endpoint requires special session-based authorization and
   * returns highly sensitive PIN data that must be handled with extreme care.
   *
   * @param cardId - Provider's unique identifier for the card
   * @returns Promise resolving to encrypted card PIN response
   * @throws CardProviderException when provider API fails
   * @throws NotFoundException when card is not found
   * @throws AuthorizationException when insufficient permissions or invalid session
   */
  getCardPin(cardId: string): Promise<CardPinResponse>;

  /**
   * Retrieves processor-specific details for a card
   *
   * This method fetches processor-related information from the card provider including:
   * - Processor's unique card identifier
   * - Time-based secret for processor authentication
   *
   * This information is typically used for integration with payment processors
   * and transaction routing systems. The processor details enable secure
   * communication between the card provider and payment processing networks.
   *
   * @param cardId - Provider's unique identifier for the card
   * @returns Promise resolving to processor details response
   * @throws CardProviderException when provider API fails
   * @throws NotFoundException when card is not found
   * @throws AuthorizationException when insufficient permissions
   */
  getProcessorDetails(cardId: string): Promise<ProcessorDetailsResponse>;

  /**
   * Retrieves multiple cards with filtering and pagination support
   *
   * This method fetches a list of cards from the card provider with support for:
   * - Filtering by user ID (required)
   * - Filtering by card status (optional)
   * - Cursor-based pagination for efficient data retrieval
   * - Configurable result limits
   *
   * The response includes the list of cards using the standard CardResponse format
   * along with pagination metadata for retrieving additional results when available.
   *
   * @param request - List cards request with filtering and pagination parameters
   * @returns Promise resolving to paginated list of cards
   * @throws CardProviderException when provider API fails
   * @throws ValidationException when request parameters are invalid
   * @throws AuthorizationException when insufficient permissions
   */
  listCards(request: ListCardsRequest): Promise<ListCardsResponse>;

  /**
   * Updates an existing card's configuration and settings
   *
   * This method allows updating various aspects of an existing card including:
   * - Spending limits and frequency controls
   * - Billing address information
   * - Card display configuration (virtual card art)
   * - Card status changes
   *
   * @param cardId - Provider's unique identifier for the card
   * @param updateRequest - Card update request with optional field updates
   * @returns Promise resolving to standardized card response
   * @throws CardProviderException when provider API fails
   * @throws NotFoundException when card is not found
   * @throws ValidationException when update data is invalid
   */
  updateCard(cardId: string, updateRequest: UpdateCardRequest): Promise<CardResponse>;

  /**
   * Encrypts a card pin using the card provider's encryption method
   *
   * This method encrypts a card pin using the card provider's encryption method.
   * It includes:
   * - Card pin encryption
   * - IV generation
   * - And sends to the card provider
   */
  updateCardPin(cardId: string, pin: string): Promise<UpdateCardPinResponse>;

  /**
   * Retrieves the occupations list from the card provider
   *
   * This method fetches the occupations list from the card provider.
   *
   * @returns Promise resolving to occupations list
   */
  getOccupations(): Promise<Occupation[]>;

  /**
   * Creates a charge for a card user
   *
   * This method creates a charge transaction for a specific user with the card provider.
   * It includes:
   * - Charge amount and description
   * - User identification
   * - Charge reference tracking
   *
   * @param userId - Provider's unique identifier for the user
   * @param amount - Charge amount
   * @param description - Charge description
   * @returns Promise resolving to standardized charge response
   * @throws CardProviderException when provider API fails
   * @throws NotFoundException when user is not found
   * @throws ValidationException when charge data is invalid
   */
  createCharge(userId: string, amount: number, description: string): Promise<CardChargeResponse>;
}

/**
 * Card Provider Enumeration
 *
 * Defines the supported card issuing providers within the OneDosh platform.
 * Each provider represents a different card issuing partner that implements
 * the CardManagementInterface, enabling standardized card operations while
 * supporting multiple backend providers.
 *
 * Provider Selection:
 * - Used during card adapter initialization to select the appropriate provider
 * - Enables runtime switching between providers based on configuration
 * - Supports A/B testing and gradual migration between providers
 *
 * Implementation Notes:
 * - Each provider value corresponds to a specific adapter implementation
 * - Provider-specific configuration is managed through environment variables
 * - All providers must implement the complete CardManagementInterface contract
 *
 * @example
 * ```typescript
 * // Initialize card adapter with specific provider
 * const cardAdapter = new CardAdapter(CardProvider.RAIN);
 *
 * // Create card user with selected provider
 * const response = await cardAdapter.createCardUser(userRequest);
 * ```
 *
 * @see CardManagementInterface - Standard interface all providers must implement
 * @see src/adapters/card/rain/ - Rain provider implementation
 * @see src/config/card.config.ts - Provider configuration management
 */
export enum CardProvider {
  /**
   * Rain Card Provider
   *
   * Rain is a modern card issuing platform that provides:
   * - Virtual and physical card issuance
   * - Real-time card controls and spending limits
   * - KYC/AML compliance and verification workflows
   * - Multi-chain stablecoin funding support
   * - Advanced fraud prevention and monitoring
   *
   * Features:
   * - Instant virtual card creation
   * - Flexible spending controls with multiple frequency options
   * - Document upload and verification workflows
   * - Real-time balance and transaction monitoring
   * - Stablecoin integration for funding operations
   *
   * Use Cases:
   * - Cross-border payments with stablecoin settlement
   * - Corporate expense management
   * - Digital wallet integration
   * - International commerce and travel
   *
   * @see https://rain.com - Rain platform documentation
   * @see src/adapters/card/rain/rain.adapter.ts - Rain adapter implementation
   */
  RAIN = 'rain',
}

export interface Occupation {
  name: string;
  code: string;
}

export interface SumSubMapping {
  [key: string]: string;
}

/**
 * Card User Creation Request
 *
 * Comprehensive data structure for creating a new card user profile
 * with any supported card provider. This standardized format ensures
 * consistent data collection regardless of provider requirements.
 */
export interface CreateCardUserRequest {
  /** OneDosh internal user identifier for linking card profile to platform account */
  proverUserRef: string;

  /** Provider-issued compliance verification token from KYC/AML processes */
  complianceToken: string;

  /** User's IP address for geolocation and fraud prevention checks */
  ipAddress: string;

  /** User's occupation for compliance and risk assessment purposes */
  occupation: string;

  /** Annual salary in USD for spending limit calculations and risk profiling */
  salary: number; // annual salary in USD

  /** User-provided reason for card usage (e.g., "online shopping", "travel") */
  cardUsageReason: string; // reason for using the card

  /** Expected monthly spending in USD for limit setting and monitoring */
  expectedMonthlySpend: number; // expected monthly spend in USD

  /** Confirmation that user has accepted card provider's terms and conditions */
  isTermAccepted: boolean;

  /** Flag indicating whether to use existing compliance documents for verification */
  useComplianceDocuments: boolean;

  /** Optional blockchain addresses for stablecoin integration and funding */
  cardStablecoinUserAddress?: CreateCardUserStablecoinAddress;

  /** User's email address for card provider's email verification */
  email: string;

  /** User's phone number for card provider's phone verification */
  phoneNumber: string;
}

/**
 * Blockchain Address Configuration
 *
 * Multi-chain wallet addresses for stablecoin funding and settlement.
 * These addresses enable direct integration between OneDosh's stablecoin
 * infrastructure and the card provider's payment processing.
 */
export interface CreateCardUserStablecoinAddress {
  /** Generic wallet address for primary blockchain operations */
  walletAddress?: string;

  /** Solana blockchain address for SPL token transactions */
  solanaAddress?: string;

  /** Tron blockchain address for TRC-20 token transactions */
  tronAddress?: string;

  /** Blockchain network identifier (e.g., "1" for Ethereum mainnet) */
  chainId?: string;

  /** Smart contract address for token operations on specified chain */
  contractAddress?: string;
}

/**
 * Standardized Card User Creation Response
 *
 * Normalized response format that abstracts provider-specific return data
 * into a consistent structure. This enables uniform handling of card user
 * creation results across all supported providers.
 *
 * @template ActionType - Provider-specific action data type
 */
export interface CreatedCardUserResponse<ActionType = any> {
  /** Provider's unique identifier for the created card user account */
  providerRef: string;

  /** Provider's parent or master account reference (for sub-account relationships) */
  providerParentRef: string;

  /** Whether the card user account is currently active and operational */
  isActive: boolean;

  /** Current status of the card user account (e.g., "pending", "approved", "suspended") */
  status: string;

  /** Confirmation that terms and conditions were accepted during creation */
  isTermAccepted: boolean;

  /** Provider-specific actions required to complete account setup or maintain compliance */
  pendingActions: Record<string, ActionType>;

  /** Reason for application status or rejection details when applicable */
  applicationStatusReason: string;
}

export interface UpdateCardUserRequest
  extends Omit<CreateCardUserRequest, 'cardStablecoinUserAddress' | 'complianceToken'> {
  cardUserAddress?: CardUserAddress;
}

export interface CardUserAddress {
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
  countryCode: string;
  country: string;
}

export interface DocumentUploadRequest {
  /** Document name or description */
  documentName: string;

  /** Document type (e.g., "passport", "idCard", "utilityBill") */
  documentType: string;

  /** Document side for ID documents (front or back) */
  documentSide: string;

  /** Country code for the document */
  country: string;

  /** Binary document file data */
  file: Buffer | File;
}

/**
 * Standardized Card Application Status Response
 *
 * Normalized response format that abstracts provider-specific application status data
 * into a consistent structure. This enables uniform handling of application status
 * tracking across all supported providers.
 */
export interface CardApplicationStatusResponse {
  /** Provider's unique identifier for the card application */
  providerRef: string;

  /** Current status of the card application (e.g., "approved", "pending", "denied") */
  status: string;

  /** Whether the card application is currently active and operational */
  isActive: boolean;

  /** Application completion link with parameters for further actions */
  applicationCompletionLink?: CardApplicationCompletionLink;

  /** Reason for application status or rejection details when applicable */
  applicationReason?: string;
}

export interface CardApplicationCompletionLink {
  url: string;
  params: Record<string, any>;
}

/**
 * Standardized Card User Balance Response
 *
 * Normalized response format that abstracts provider-specific balance data
 * into a consistent structure. This enables uniform handling of user balance
 * information across all supported providers.
 */
export interface CardUserBalanceResponse {
  /** Credit limit assigned to the user account */
  creditLimit: number;

  /** Pending charges that have not yet been posted */
  pendingCharges: number;

  /** Posted charges that have been finalized */
  postedCharges: number;

  /** Outstanding balance due for payment */
  balanceDue: number;

  /** Available spending power (typically creditLimit - pendingCharges - postedCharges) */
  spendingPower: number;
}

/**
 * Standardized Card Partner Balance Response
 *
 * Normalized response format that abstracts provider-specific partner/organization balance data
 * into a consistent structure. This enables uniform handling of organization balance
 * information across all supported providers.
 */
export interface CardPartnerBalanceResponse {
  /** Credit limit assigned to the organization account */
  creditLimit: number;

  /** Pending charges that have not yet been posted */
  pendingCharges: number;

  /** Posted charges that have been finalized */
  postedCharges: number;

  /** Outstanding balance due for payment */
  balanceDue: number;

  /** Available spending power (typically creditLimit - pendingCharges - postedCharges) */
  spendingPower: number;
}

/**
 * Card Type Enumeration
 */
export enum CardType {
  VIRTUAL = 'virtual',
  PHYSICAL = 'physical',
}

/**
 * Card Limit Frequency Enumeration
 */
export enum CardLimitFrequency {
  PER_24_HOUR_PERIOD = 'per24HourPeriod',
  PER_7_DAY_PERIOD = 'per7DayPeriod',
  PER_30_DAY_PERIOD = 'per30DayPeriod',
  PER_YEAR_PERIOD = 'perYearPeriod',
  ALL_TIME = 'allTime',
  PER_AUTHORIZATION = 'perAuthorization',
}

/**
 * Shipping Method Enumeration
 */
export enum ShippingMethod {
  STANDARD = 'standard',
  EXPRESS = 'express',
  INTERNATIONAL = 'international',
  APC = 'apc',
  USPS_INTERNATIONAL = 'uspsinternational',
}

/**
 * Card Status Enumeration
 */
export enum CardStatus {
  NOT_ACTIVATED = 'notActivated',
  ACTIVE = 'active',
  LOCKED = 'locked',
  CANCELED = 'canceled',
}

/**
 * Card Creation Request
 *
 * Comprehensive data structure for creating a new card (virtual or physical)
 * with any supported card provider. This unified format handles both card types
 * with conditional requirements based on the card type.
 */
export interface CreateCardRequest {
  /** Provider's unique identifier for the card user */
  providerUserRef: string;

  /** Type of card to create (virtual or physical) */
  type: CardType;

  /** Spending limit configuration */
  limit: CardLimit;

  /** Card display and configuration settings */
  configuration?: CardConfiguration;

  /** Card user information */
  firstName: string;
  lastName: string;

  /** Billing address information */
  billing: CardAddress;

  /** Shipping address information (required for physical cards only) */
  shipping?: CardShipping;

  /** Initial card status */
  status: CardStatus;

  /** Bulk shipping group ID (optional, physical cards only) */
  bulkShippGroupId?: string;
}

/**
 * Card Spending Limit Configuration
 */
export interface CardLimit {
  /** Frequency of the spending limit (per day, per month, etc.) */
  frequency: CardLimitFrequency;

  /** Maximum spending amount for the specified frequency */
  amount: number;
}

/**
 * Card Display Configuration
 */
export interface CardConfiguration {
  /** Product identifier */
  productId: string;

  /** Product reference */
  productRef: string;

  /** Virtual card art identifier (for virtual cards) */
  virtualCardArt?: string;
}

/**
 * Card Address Information (used for billing)
 */
export interface CardAddress {
  /** Address line 1 */
  line1: string;

  /** Address line 2 (optional) */
  line2?: string;

  /** City */
  city: string;

  /** State/Region */
  region: string;

  /** Postal/ZIP code */
  postalCode: string;

  /** Country code (e.g., "US") */
  countryCode: string;

  /** Country name */
  country: string;
}

/**
 * Card Shipping Information (required for physical cards)
 */
export interface CardShipping extends CardAddress {
  /** Phone number for delivery */
  phoneNumber: string;

  /** Shipping method */
  method: ShippingMethod;
}

/**
 * Standardized Card Creation Response
 *
 * Normalized response format that abstracts provider-specific card creation data
 * into a consistent structure. This enables uniform handling of card creation
 * results across all supported providers.
 */
export interface CardResponse {
  /** Provider's unique identifier for the card */
  cardId: string;

  /** Card type (virtual or physical) */
  type: CardType;

  /** Current card status */
  status: CardStatus;

  /** Whether the card is currently active */
  isActive: boolean;

  /** Card display name */
  displayName: string;

  /** Last 4 digits of the card number (when available) */
  lastFourDigits?: string;

  /** Card expiration Month (when available) */
  expiryMonth: string;

  /** Card expiration year (when available) */
  expiryYear: string;

  /** Card limit amount */
  limitAmount: number;

  /** Card limit frequency */
  limitFrequency: CardLimitFrequency;

  /** Provider-specific metadata */
  providerMetadata?: Record<string, any>;
}

export interface UpdateCardRequest {
  /** Spending limit configuration */
  limit?: CardLimit;

  /** Card display and configuration settings */
  configuration?: CardConfiguration;

  /** Card user information */
  firstName?: string;
  lastName?: string;

  /** Billing address information */
  billing?: CardAddress;

  /** Shipping address information (required for physical cards only) */
  shipping?: CardShipping;

  /** Card status */
  status?: CardStatus;

  /** Bulk shipping group ID (optional, physical cards only) */
  bulkShippGroupId?: string;
}

/**
 * Card Pin Update Response
 *
 * Normalized response format that abstracts provider-specific card pin update data
 * into a consistent structure. This enables uniform handling of card pin update
 * results across all supported providers.
 */
export interface UpdateCardPinResponse {
  /** Encrypted card pin */
  encryptedPin: string;

  /** Encoded IV */
  encodedIv: string;
}

/**
 * Encrypted Data Structure
 *
 * Standardized structure for encrypted sensitive data with initialization vector.
 * Used for secure transmission of card details like PAN and CVC.
 */
export interface EncryptedData {
  /** Initialization vector for decryption */
  iv: string;

  /** Encrypted data payload */
  data: string;
}

/**
 * Card Secrets Response
 *
 * Normalized response format that abstracts provider-specific encrypted card secrets
 * into a consistent structure. This enables uniform handling of sensitive card data
 * like PAN and CVC across all supported providers.
 */
export interface CardSecretsResponse {
  /** Decrypted Primary Account Number (card number) */
  decryptedPan: string;

  /** Decrypted Card Verification Code (CVC/CVV) */
  decryptedCvc: string;
}

/**
 * Card PIN Response
 *
 * Normalized response format that abstracts provider-specific encrypted card PIN data
 * into a consistent structure. This enables uniform handling of sensitive PIN data
 * across all supported providers.
 */
export interface CardPinResponse {
  /** Encrypted Personal Identification Number (PIN) */
  encryptedPin: EncryptedData;
}

/**
 * Processor Details Response
 *
 * Normalized response format that abstracts provider-specific card processor details
 * into a consistent structure. This enables uniform handling of processor-related
 * card information across all supported providers.
 */
export interface ProcessorDetailsResponse {
  /** Processor's unique identifier for the card */
  processorCardId: string;

  /** Time-based secret for processor authentication */
  timeBasedSecret: string;
}

/**
 * List Cards Request
 *
 * Request parameters for retrieving multiple cards with filtering and pagination options.
 * Supports filtering by user ID, card status, and includes cursor-based pagination
 * for efficient data retrieval across large card datasets.
 */
export interface ListCardsRequest {
  /** Provider user ID to filter cards by (required) */
  userId: string;

  /** Card status to filter by (optional) */
  status?: CardStatus;

  /** Pagination cursor for retrieving next set of results (optional) */
  cursor?: string;

  /** Maximum number of cards to return (optional, defaults to provider limit) */
  limit?: number;
}

/**
 * List Cards Response
 *
 * Normalized response format that abstracts provider-specific card list data
 * into a consistent structure. Returns an array of cards using the existing
 * CardResponse interface for consistency across all card operations.
 */
export interface ListCardsResponse {
  /** Array of cards matching the request criteria */
  cards: CardResponse[];

  /** Pagination cursor for retrieving next page of results (if available) */
  nextCursor?: string;

  /** Whether there are more cards available beyond the current page */
  hasMore?: boolean;
}

/**
 * Card Charge Response
 *
 * Normalized response format that abstracts provider-specific charge data
 * into a consistent structure. This enables uniform handling of charge
 * creation results across all supported providers.
 */
export interface CardChargeResponse {
  /** Provider's unique identifier for the charge */
  providerRef: string;

  /** Charge creation timestamp */
  createdAt: string;

  /** Charge amount */
  amount: number;

  /** Charge description */
  description: string;
}
