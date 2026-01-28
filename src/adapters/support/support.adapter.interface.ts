/**
 * Support Management Interface
 *
 * This interface defines a standardized contract for support operations
 * across different support providers in the OneDosh platform.
 * It serves as an adapter layer that transforms and normalizes responses from
 * various support providers (Zendesk, etc.) into a consistent format.
 *
 * Purpose:
 * - Abstracts provider-specific implementations behind a unified interface
 * - Enables seamless switching between different support providers
 * - Standardizes request/response formats across all support operations
 * - Supports ticket creation and management workflows
 *
 * Provider Integration:
 * Each support provider implements this interface through their specific adapter,
 * allowing the OneDosh platform to support multiple support partners
 * while maintaining consistent business logic and API contracts.
 *
 * Data Flow:
 * Controller → Service → Support Adapter → Provider API → Standardized Response
 *
 * @see src/adapters/support/zendesk/ - Zendesk support provider implementation
 * @see src/modules/support/ - Support management module
 */
export interface SupportManagementInterface {
  /**
   * Creates a new support ticket with the selected support provider
   *
   * This method creates a support ticket with the provider, enabling
   * customer support workflows. The process includes:
   * - Ticket creation with subject, description, and content
   * - User identification and email association
   * - Ticket metadata and tracking
   *
   * The response is normalized across all providers to ensure consistent
   * handling regardless of the underlying support provider's API structure.
   *
   * @param ticketRequest - Ticket information and user data for ticket creation
   * @returns Promise resolving to standardized ticket creation response
   * @throws SupportProviderException when provider API fails
   * @throws ValidationException when required data is invalid
   */
  createTicket(ticketRequest: CreateTicketRequest): Promise<CreatedTicketResponse>;

  /**
   * Retrieves ticket details from the selected support provider
   *
   * This method fetches comprehensive ticket details from the provider including:
   * - Ticket status and priority
   * - Ticket comments and history
   * - User information and metadata
   *
   * @param ticketId - Provider's unique identifier for the ticket
   * @returns Promise resolving to standardized ticket details response
   * @throws SupportProviderException when provider API fails
   * @throws NotFoundException when ticket is not found
   */
  getTicket(ticketId: string): Promise<TicketResponse>;

  /**
   * Updates an existing ticket with the selected support provider
   *
   * This method allows updating ticket information including:
   * - Status changes
   * - Priority updates
   * - Comment additions
   *
   * @param ticketId - Provider's unique identifier for the ticket
   * @param updateRequest - Ticket update request with optional field updates
   * @returns Promise resolving to standardized ticket response
   * @throws SupportProviderException when provider API fails
   * @throws NotFoundException when ticket is not found
   * @throws ValidationException when update data is invalid
   */
  updateTicket(ticketId: string, updateRequest: UpdateTicketRequest): Promise<TicketResponse>;

  /**
   * Adds a comment to an existing ticket
   *
   * This method adds a comment or reply to an existing ticket.
   *
   * @param ticketId - Provider's unique identifier for the ticket
   * @param comment - Comment content and metadata
   * @returns Promise resolving to standardized comment response
   * @throws SupportProviderException when provider API fails
   * @throws NotFoundException when ticket is not found
   */
  addComment(ticketId: string, comment: AddCommentRequest): Promise<CommentResponse>;
}

/**
 * Support Provider Enumeration
 *
 * Defines the supported support providers within the OneDosh platform.
 * Each provider represents a different support partner that implements
 * the SupportManagementInterface, enabling standardized support operations while
 * supporting multiple backend providers.
 *
 * Provider Selection:
 * - Used during support adapter initialization to select the appropriate provider
 * - Enables runtime switching between providers based on configuration
 * - Supports A/B testing and gradual migration between providers
 *
 * Implementation Notes:
 * - Each provider value corresponds to a specific adapter implementation
 * - Provider-specific configuration is managed through environment variables
 * - All providers must implement the complete SupportManagementInterface contract
 *
 * @see SupportManagementInterface - Standard interface all providers must implement
 * @see src/adapters/support/zendesk/ - Zendesk provider implementation
 * @see src/config/support.config.ts - Provider configuration management
 */
export enum SupportProvider {
  /**
   * Zendesk Support Provider
   *
   * Zendesk is a customer service platform that provides:
   * - Ticket management and tracking
   * - Multi-channel support (email, chat, phone)
   * - Customer relationship management
   * - Analytics and reporting
   *
   * Features:
   * - Ticket creation and updates
   * - Comment threading
   * - User management
   * - Ticket status tracking
   *
   * Use Cases:
   * - Customer support ticket management
   * - Issue tracking and resolution
   * - Customer communication
   *
   * @see https://developer.zendesk.com - Zendesk API documentation
   * @see src/adapters/support/zendesk/zendesk.adapter.ts - Zendesk adapter implementation
   */
  ZENDESK = 'zendesk',
}

/**
 * Ticket Creation Request
 *
 * Comprehensive data structure for creating a new support ticket
 * with any supported support provider. This standardized format ensures
 * consistent data collection regardless of provider requirements.
 */
export interface CreateTicketRequest {
  /** Ticket subject or title */
  subject: string;

  /** Ticket description or summary */
  description: string;

  /** Detailed ticket content or body */
  content: string;

  /** User's email address associated with the ticket */
  userEmail: string;

  /** Optional user identifier for linking ticket to platform account */
  userId?: string;

  /** Optional requester name */
  requesterName?: string;

  /** Optional resource ID related to the ticket */
  resourceId?: string;

  /** Optional ticket priority */
  priority?: TicketPriority;

  /** Optional ticket type */
  type?: TicketType;

  /** Optional custom fields */
  customFields?: Record<string, any>;

  /** Optional tags */
  tags?: string[];
}

/**
 * Ticket Priority Enumeration
 */
export enum TicketPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

/**
 * Ticket Type Enumeration
 */
export enum TicketType {
  QUESTION = 'question',
  INCIDENT = 'incident',
  PROBLEM = 'problem',
  TASK = 'task',
}

/**
 * Standardized Ticket Creation Response
 *
 * Normalized response format that abstracts provider-specific return data
 * into a consistent structure. This enables uniform handling of ticket
 * creation results across all supported providers.
 */
export interface CreatedTicketResponse {
  /** Provider's unique identifier for the created ticket */
  ticketId: string;

  /** Ticket number or reference for customer-facing display */
  ticketNumber: string;

  /** Current ticket status */
  status: TicketStatus;

  /** Ticket subject */
  subject: string;

  /** Ticket creation timestamp */
  createdAt: string;

  /** Provider-specific metadata */
  providerMetadata?: Record<string, any>;
}

/**
 * Ticket Status Enumeration
 */
export enum TicketStatus {
  NEW = 'new',
  OPEN = 'open',
  PENDING = 'pending',
  SOLVED = 'solved',
  CLOSED = 'closed',
}

/**
 * Standardized Ticket Response
 *
 * Normalized response format that abstracts provider-specific ticket data
 * into a consistent structure. This enables uniform handling of ticket
 * information across all supported providers.
 */
export interface TicketResponse {
  /** Provider's unique identifier for the ticket */
  ticketId: string;

  /** Ticket number or reference for customer-facing display */
  ticketNumber: string;

  /** Current ticket status */
  status: TicketStatus;

  /** Ticket priority */
  priority: TicketPriority;

  /** Ticket type */
  type: TicketType;

  /** Ticket subject */
  subject: string;

  /** Ticket description */
  description: string;

  /** Ticket content or body */
  content: string;

  /** User's email address associated with the ticket */
  userEmail: string;

  /** Ticket creation timestamp */
  createdAt: string;

  /** Ticket last update timestamp */
  updatedAt: string;

  /** Provider-specific metadata */
  providerMetadata?: Record<string, any>;
}

/**
 * Ticket Update Request
 *
 * Request parameters for updating an existing ticket with optional field updates.
 */
export interface UpdateTicketRequest {
  /** Ticket status */
  status?: TicketStatus;

  /** Ticket priority */
  priority?: TicketPriority;

  /** Ticket type */
  type?: TicketType;

  /** Ticket subject */
  subject?: string;

  /** Ticket description */
  description?: string;

  /** Ticket content or body */
  content?: string;

  /** Optional tags */
  tags?: string[];

  /** Optional custom fields */
  customFields?: Record<string, any>;
}

/**
 * Comment Addition Request
 *
 * Request parameters for adding a comment to an existing ticket.
 */
export interface AddCommentRequest {
  /** Comment content or body */
  body: string;

  /** Whether the comment is public (visible to user) or private (internal) */
  public?: boolean;

  /** Optional author email */
  authorEmail?: string;
}

/**
 * Standardized Comment Response
 *
 * Normalized response format that abstracts provider-specific comment data
 * into a consistent structure. This enables uniform handling of comments
 * across all supported providers.
 */
export interface CommentResponse {
  /** Provider's unique identifier for the comment */
  commentId: string;

  /** Comment content or body */
  body: string;

  /** Whether the comment is public (visible to user) or private (internal) */
  public: boolean;

  /** Comment author email */
  authorEmail: string;

  /** Comment creation timestamp */
  createdAt: string;

  /** Provider-specific metadata */
  providerMetadata?: Record<string, any>;
}
