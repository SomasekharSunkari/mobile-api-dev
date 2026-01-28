import { Inject, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { KYCAdapter } from '../../adapters/kyc/kyc-adapter';
import {
  DocumentResource,
  GetDocumentContentPayload,
  GetDocumentContentResponse,
  GetDocumentInfoPayload,
  GetDocumentInfoResponse,
  GetKycDetailsResponse,
  IdentityDocSubType,
  IdentityDocType,
  KycBaseResponse,
  VerificationResult,
} from '../../adapters/kyc/kyc-adapter.interface';
import { ParticipantAdapter } from '../../adapters/participant/participant.adapter';
import {
  DocumentUploadRequest,
  ParticipantCreateRequest,
  ParticipantCreateResponse,
  ParticipantUpdateRequest,
} from '../../adapters/participant/participant.adapter.interface';
import { AdapterConfigProvider } from '../../config/adapter.config';
import { UserModel } from '../../database';
import { ExternalAccountStatus } from '../../database/models/externalAccount/externalAccount.interface';
import { DepositAddressService } from '../depositAddress/depositAddress.service';
import { ExternalAccountRepository } from '../externalAccount/external-account.repository';
import { ExternalAccountService } from '../externalAccount/external-account.service';
import { ParticipantIDStatus } from './participant.interface';

@Injectable()
export class ParticipantService {
  private readonly logger = new Logger(ParticipantService.name);

  @Inject(ParticipantAdapter)
  private readonly participantAdapter: ParticipantAdapter;

  @Inject(KYCAdapter)
  private readonly kycAdapter: KYCAdapter;

  @Inject(ExternalAccountService)
  private readonly externalAccountService: ExternalAccountService;

  @Inject(DepositAddressService)
  private readonly depositAddressService: DepositAddressService;

  @Inject(AdapterConfigProvider)
  private readonly adapterConfig: AdapterConfigProvider;

  @Inject(ExternalAccountRepository)
  private readonly externalAccountRepository: ExternalAccountRepository;

  /**
   * COMPLETE PARTICIPANT ONBOARDING FLOW
   *
   * This method handles the complete end-to-end participant onboarding:
   * 1. Duplicate prevention: Checks for existing participants before creating
   * 2. Multi-country support: Handles US (SSN) and NG (BVN) users
   * 3. Unified tax ID: Uses 'tin' field for both SSN and BVN
   * 4. Provider-agnostic: Creates external account records for tracking
   * 5. Timestamp validation: Ensures dates aren't in the future
   * 6. Document processing and upload
   * 7. Participant data updates with KYC information
   */
  async createParticipant(
    kycData: GetKycDetailsResponse,
    user: UserModel,
    applicantId?: string,
  ): Promise<ParticipantCreateResponse> {
    this.logger.log('Creating participant for user', kycData.userId);

    try {
      // DUPLICATE PREVENTION: Check for existing participant first
      this.logger.log('Checking for existing external account with participant_code');
      const existingExternalAccountResponse = await this.externalAccountService.getExternalAccounts(user);

      const existingExternalAccounts = existingExternalAccountResponse.external_accounts ?? [];

      const normalizedCountry = this.normalizeCountryCode(kycData.country);

      // Look for any existing participant for this country's supported provider
      const existingExternalAccount = existingExternalAccounts.find(
        (account) => account.participant_code && account.provider,
      );

      if (existingExternalAccount) {
        this.logger.log(
          `Found existing participant with code: ${existingExternalAccount.participant_code} for provider: ${existingExternalAccount.provider}`,
        );
        return {
          providerRef: existingExternalAccount.participant_code,
          provider: existingExternalAccount.provider,
        };
      }

      this.logger.log('No existing participant found, creating new participant');
      const isUS = normalizedCountry === 'US';

      // TIMESTAMP VALIDATION: Ensure dates aren't in the future
      this.logger.log('completedAt:', kycData.completedAt);
      this.logger.log('reviewedAt:', kycData.reviewedAt);
      this.logger.log('agreementAcceptedAt:', kycData.agreementAcceptedAt);
      this.logger.log('Current time:', new Date().toISOString());

      const now = new Date();
      const completedAtDate = new Date(kycData.completedAt);
      const agreementAcceptedAtDate = new Date(kycData.agreementAcceptedAt);

      const safeCompletedAt = completedAtDate > now ? now : completedAtDate;
      const safeAgreementAcceptedAt = agreementAcceptedAtDate > now ? now : agreementAcceptedAtDate;

      this.logger.log('Safe completedAt:', safeCompletedAt.toISOString());
      this.logger.log('Safe agreementAcceptedAt:', safeAgreementAcceptedAt.toISOString());

      // UNIFIED TAX ID: Single field for both SSN (US) and BVN (NG)
      const participantPayload: ParticipantCreateRequest = {
        firstName: kycData.firstName,
        lastName: kycData.lastName,
        email: user.email,
        address: kycData.address.address,
        city: kycData.address.city,
        state: kycData.address?.state,
        country: normalizedCountry,
        dob: kycData.dob,
        tin: kycData.idNumber, // UNIFIED: SSN for US users, BVN for NG users
        kyc: 'pass',
        kycTimestamp: Math.floor(safeCompletedAt.getTime() / 1000),
        compliance: 'pass',
        complianceTimestamp: Math.floor(safeCompletedAt.getTime() / 1000),
        signedTimestamp: Math.floor(safeAgreementAcceptedAt.getTime() / 1000),
      };

      // US-specific fields
      if (isUS) {
        participantPayload.zip = kycData.address?.postalCode;
      }

      // get the participant ref from the provider
      const participantRef = await this.participantAdapter.getParticipantRef({ email: user.email }, normalizedCountry);

      let participantResponse: ParticipantCreateResponse;

      if (!participantRef.ref) {
        // check if the user has external account
        participantResponse = await this.participantAdapter.createParticipant(participantPayload);
        this.logger.log('Participant created successfully', participantResponse);
      } else {
        participantResponse = { providerRef: participantRef.ref, provider: participantRef.provider };
      }

      // Create participant via provider-agnostic adapter

      // RACE CONDITION FIX: Create external account record with proper provider AFTER participant creation
      // This prevents webhooks from arriving before the record exists in our database
      try {
        let externalAccount = await this.externalAccountRepository.findOne({
          user_id: user.id,
          participant_code: participantRef.ref,
        });

        if (!externalAccount) {
          externalAccount = await this.createExternalAccountRecord(
            user,
            participantResponse.providerRef,
            participantResponse.provider,
          );
          this.logger.log(
            `Created external account ${externalAccount.id} with participant code: ${participantResponse.providerRef}`,
          );
        }
      } catch (error) {
        this.logger.error('Failed to create external account record', error);
        throw new InternalServerErrorException('Failed to create external account record');
      }

      // COMPLETE ONBOARDING: If applicantId is provided, process documents and update participant
      if (applicantId) {
        this.logger.log('Processing documents for complete participant onboarding');

        // Check if participant already has valid KYC status
        try {
          const kycStatus = await this.participantAdapter.getKycStatus(
            { userRef: participantResponse.providerRef },
            normalizedCountry,
          );

          // Skip document processing if both identity verification and liveness verification are already passed
          if (
            kycStatus.identityVerification === 'pass' &&
            kycStatus.livenessVerification === 'pass' &&
            kycStatus.isEnhancedDueDiligence
          ) {
            this.logger.log('Participant already has valid KYC status, skipping document processing');
            return participantResponse;
          }

          this.logger.log('Participant KYC status requires document processing, continuing...');
        } catch (error) {
          this.logger.warn('Failed to get KYC status, proceeding with document processing:', error.message);
        }

        // Get all documents first to check liveness
        const documentInfoPayload: GetDocumentInfoPayload = { applicantId };
        const documentInfo: KycBaseResponse<GetDocumentInfoResponse> =
          await this.kycAdapter.getDocumentInfo(documentInfoPayload);

        // Check liveness verification across all documents (including SELFIE)
        const livenessCheckResult = this.checkLivenessResult(documentInfo.data.documents);
        this.logger.log(`Liveness check result: ${livenessCheckResult}`);

        // Process and filter relevant documents (PASSPORT, DRIVERS front only)
        const documentsWithContent = await this.processDocumentInfo(applicantId, kycData);

        if (documentsWithContent && documentsWithContent.length > 0) {
          // Upload processed documents to external provider
          await this.uploadKycDocumentsToProvider(
            documentsWithContent,
            participantResponse.providerRef,
            normalizedCountry,
          );

          // IMPORTANT: Only update participant if liveness check has been completed
          // This ensures we don't update participant prematurely before SELFIE/liveness verification
          if (livenessCheckResult === 'pass') {
            this.logger.log('Liveness check passed, updating participant with KYC data');
            await this.updateParticipantWithKycData(participantResponse.providerRef, kycData, documentsWithContent);
          } else {
            this.logger.log('Liveness check not completed or failed, skipping participant update');
          }
        }
      }

      // CREATE DEPOSIT ADDRESS: Generate deposit address for the participant
      try {
        this.logger.log('Creating deposit address for participant');
        const defaultAsset = this.adapterConfig.getConfig().default_underlying_currency;

        await this.depositAddressService.createDepositAddress(
          user,
          participantResponse.providerRef,
          defaultAsset,
          participantResponse.provider,
        );
        this.logger.log('Deposit address created successfully');
      } catch (error) {
        this.logger.error('Failed to create deposit address, but continuing with participant creation', error);
        // GRACEFUL: Don't throw error - deposit address creation failure shouldn't break participant creation
      }

      return participantResponse;
    } catch (error) {
      this.logger.error('Error creating participant', error);
      throw new InternalServerErrorException('Failed to create participant');
    }
  }

  /**
   * DOCUMENT UPLOAD TO PROVIDER
   *
   * Uploads processed documents to external provider via participant adapter
   * - Maps document types to provider format
   * - Determines front/back side classification
   * - Handles upload failures gracefully (doesn't break flow)
   */
  async uploadKycDocumentsToProvider(documentsWithContent: any[], userRef: string, country: string): Promise<void> {
    this.logger.log(`Uploading ${documentsWithContent.length} documents to provider for participant: ${userRef}`);

    try {
      for (const documentInfo of documentsWithContent) {
        // Determine if this is a front side document for external provider
        const isIdFront = this.determineIfFrontSide(documentInfo.idDocType, documentInfo.idDocSubType);

        // Prepare document upload payload for external provider
        const uploadPayload: DocumentUploadRequest = {
          documentType: documentInfo.idNumberType,
          document: documentInfo.document,
          mime: documentInfo.mime,
          fileName: documentInfo.fileName,
          userRef: userRef,
          idFront: isIdFront,
          country: country,
        };

        const docTypeDisplay = documentInfo.idDocSubType
          ? `${documentInfo.idDocType} ${documentInfo.idDocSubType}`
          : documentInfo.idDocType;

        // Upload document via provider-agnostic participant adapter
        await this.participantAdapter.uploadKycDocument(uploadPayload);

        this.logger.log(`Uploaded ${docTypeDisplay} for participant: ${userRef}`);
      }
    } catch (error) {
      this.logger.error(`Error uploading documents for participant ${userRef}:`, error);
      // GRACEFUL: Don't throw error - document upload failure shouldn't break the entire flow
    }
  }

  /**
   * PARTICIPANT UPDATE WITH KYC DATA
   *
   * Updates external provider participant with additional information after document upload:
   * - Uses best available document (prefers PASSPORT over DRIVERS)
   * - Includes IDV status, liveness check, tax ID
   * - Handles missing data gracefully
   */
  async updateParticipantWithKycData(userRef: string, kycData: any, documentsWithContent: any[]): Promise<void> {
    this.logger.log(`Updating participant ${userRef} with KYC data`);

    try {
      if (!documentsWithContent || documentsWithContent.length === 0) {
        this.logger.warn(`No documents found for participant ${userRef}, skipping update`);
        return;
      }

      // SMART SELECTION: Prefer PASSPORT over DRIVERS for more reliable data
      const preferredDocument =
        documentsWithContent.find((doc) => doc.idDocType === IdentityDocType.PASSPORT) ??
        documentsWithContent.find((doc) => doc.idDocType === IdentityDocType.DRIVERS) ??
        documentsWithContent[0];

      this.logger.log(`Using ${preferredDocument.idDocType} for participant update`);

      // VALIDATION: Check required data fields
      // IMPROVED: Using optional chaining for better error handling
      if (!kycData.idDocument?.number) {
        this.logger.error(`Missing idDocument.number in kycData for participant ${userRef}`);
        return;
      }

      if (!kycData.idNumber) {
        this.logger.error(`Missing idNumber (TIN) in kycData for participant ${userRef}`);
        return;
      }

      // Prepare participant update payload with comprehensive KYC data
      const updatePayload: ParticipantUpdateRequest = {
        userRef: userRef,
        platformUpdatedAt: preferredDocument.platformUpdatedAt,
        idNumber: kycData.idDocument.number, // Passport/License number
        idNumberType: preferredDocument.idNumberType,
        livenessCheck: preferredDocument.livenessCheck,
        idv: preferredDocument.idv, // Identity verification status
        taxIdNumber: kycData.idNumber, // BVN for NG, SSN for US
        citizenshipCode: preferredDocument.citizenshipCode,
        employmentStatus: kycData.employmentStatus,
        sourceOfFunds: kycData.sourceOfFunds,
        industry: kycData.mostRecentOccupation,
      };

      // Update participant via provider-agnostic adapter
      await this.participantAdapter.updateParticipant(updatePayload);

      this.logger.log(`Updated participant ${userRef}`);
    } catch (error) {
      this.logger.error(`Error updating participant ${userRef}:`, error);
      // GRACEFUL: Don't throw error - update failure shouldn't break the entire flow
    }
  }

  /**
   * COUNTRY CODE NORMALIZATION
   *
   * Standardizes country codes for consistent processing
   * Maps Sumsub country codes to our internal format
   */
  public normalizeCountryCode(country: string): string {
    if (country === 'USA') return 'US';
    if (country === 'NGA') return 'NG';
    return country;
  }

  /**
   * FRONT SIDE DETERMINATION
   *
   * Determines if a document should be treated as "front side" for external provider upload
   * Rules:
   * - PASSPORT: Always front (single upload)
   * - DRIVERS: FRONT_SIDE = true, BACK_SIDE = false
   * - RESIDENCE_PERMIT: FRONT_SIDE = true, BACK_SIDE = false
   */
  private determineIfFrontSide(idDocType: IdentityDocType, idDocSubType: IdentityDocSubType): boolean {
    if (idDocType === IdentityDocType.PASSPORT) {
      return true; // Passport has only one upload, considered "front"
    }

    if (idDocType === IdentityDocType.DRIVERS) {
      return idDocSubType === IdentityDocSubType.FRONT_SIDE;
    }

    if (idDocType === IdentityDocType.RESIDENCE_PERMIT) {
      return idDocSubType === IdentityDocSubType.FRONT_SIDE;
    }

    return false; // Default for unsupported document types
  }

  /**
   * EXTERNAL ACCOUNT RECORD CREATION
   *
   * Creates database records linking users to external providers
   * Enables tracking of participant codes and provider relationships
   * Supports creating placeholder records (userRef=null) to prevent race conditions
   */
  private async createExternalAccountRecord(user: any, userRef: string, provider: string): Promise<any> {
    this.logger.log(`Creating external account record for user ${user.id} with participant code ${userRef}`);
    try {
      const externalAccount = await this.externalAccountService.create({
        user_id: user.id,
        participant_code: userRef,
        provider: provider,
        status: ExternalAccountStatus.PENDING, // Initial status, will be updated by provider webhooks
        provider_kyc_status: 'approved', // Set to approved since participant was successfully created
      });

      this.logger.log(`Created external account record: ${externalAccount.id}`);
      return externalAccount;
    } catch (error) {
      this.logger.error(error);
      throw new InternalServerErrorException('Failed to create external account record');
    }
  }

  /**
   * DOCUMENT PROCESSING SYSTEM
   *
   * Fetches documents from Sumsub and processes supported ones for external providers:
   * - PASSPORT: Always processed (single upload)
   * - DRIVERS: Both FRONT_SIDE and BACK_SIDE processed
   * - RESIDENCE_PERMIT: Both FRONT_SIDE and BACK_SIDE processed
   * - SELFIE: Skipped (used only for liveness verification)
   * - Other document types: Skipped
   */
  private async processDocumentInfo(applicantId: string, kycDetails: GetKycDetailsResponse) {
    this.logger.log('Processing document info for applicant:', applicantId);

    try {
      const documentInfoPayload: GetDocumentInfoPayload = { applicantId };
      const documentInfo: KycBaseResponse<GetDocumentInfoResponse> =
        await this.kycAdapter.getDocumentInfo(documentInfoPayload);
      this.logger.log('Document info retrieved:', documentInfo.data);

      // Check liveness verification across all documents
      const livenessCheckResult = this.checkLivenessResult(documentInfo.data.documents);
      const documentsWithContent = [];

      // Process each document individually with filtering
      for (const document of documentInfo.data.documents) {
        const processedDocument = await this.processSingleDocument(document, kycDetails, livenessCheckResult);
        if (processedDocument) {
          documentsWithContent.push(processedDocument);
        }
      }

      this.logger.log(`Processed ${documentsWithContent.length} documents for applicant ${applicantId}`);
      return documentsWithContent;
    } catch (error) {
      this.logger.error(`Error processing document info for applicant ${applicantId}:`, error);
      throw new InternalServerErrorException(`Failed to process document info for applicant ${applicantId}`);
    }
  }

  /**
   * INDIVIDUAL DOCUMENT PROCESSOR
   *
   * Enhanced filtering logic:
   * - Processes ALL relevant document types for external providers
   * - PASSPORT: Always processed (single upload)
   * - DRIVERS: Both FRONT_SIDE and BACK_SIDE processed
   * - RESIDENCE_PERMIT: Both FRONT_SIDE and BACK_SIDE processed
   * - SELFIE: Skipped (used only for liveness verification)
   * - Other document types: Skipped
   */
  private async processSingleDocument(
    document: DocumentResource,
    kycDetails: any,
    livenessCheckResult: ParticipantIDStatus,
  ) {
    const docTypeDisplay = document.documentSubType
      ? `${document.documentType} ${document.documentSubType}`
      : document.documentType;

    this.logger.log(`Evaluating document: ${docTypeDisplay} (ID: ${document.id})`);

    // Skip SELFIE documents as they're not meant for external provider upload (only for liveness check)
    if (document.documentType === IdentityDocType.SELFIE) {
      this.logger.log(`Skipping SELFIE document (ID: ${document.id}) - Used for liveness verification only`);
      return null;
    }

    // FILTER: Process all relevant document types for external providers
    const shouldProcessDocument =
      document.documentType === IdentityDocType.PASSPORT ||
      (document.documentType === IdentityDocType.DRIVERS &&
        (document.documentSubType === IdentityDocSubType.FRONT_SIDE ||
          document.documentSubType === IdentityDocSubType.BACK_SIDE)) ||
      (document.documentType === IdentityDocType.RESIDENCE_PERMIT &&
        (document.documentSubType === IdentityDocSubType.FRONT_SIDE ||
          document.documentSubType === IdentityDocSubType.BACK_SIDE));

    if (!shouldProcessDocument) {
      this.logger.log(
        `Skipping document: ${docTypeDisplay} (ID: ${document.id}) - Not a supported document type for external provider`,
      );
      return null;
    }

    this.logger.log(`Processing ${docTypeDisplay} (ID: ${document.id})`);

    try {
      // Fetch actual document content from Sumsub
      const documentContentPayload: GetDocumentContentPayload = {
        referenceId: kycDetails.referenceId,
        documentId: document.id,
      };
      const documentContent: KycBaseResponse<GetDocumentContentResponse> =
        await this.kycAdapter.getDocumentContent(documentContentPayload);

      // Log document info without exposing base64 content
      this.logger.log(
        `Fetched content for ${document.id}: ${documentContent.data.fileName} (${documentContent.data.content?.length || 0} bytes)`,
      );

      // Validate document content
      if (!documentContent.data.content) {
        this.logger.error(`No content received for document ${document.id}`);
        return null;
      }

      // Determine IDV (Identity Verification) status for this specific document
      const idvStatus = this.determineIdvStatusForDocument(document);

      // Prepare complete document information for external provider upload
      const completeDocumentInfo = {
        document: documentContent.data.content,
        mime: document.mimeType,
        fileName: document.originalFileName,
        platformUpdatedAt: document.lastUpdatedAt,
        idNumber: kycDetails.idDocument?.number,
        idNumberType: this.getIdNumberType(document.documentType, this.normalizeCountryCode(document.country)),
        livenessCheck: livenessCheckResult,
        idv: idvStatus,
        taxId: kycDetails.idNumber, // BVN for NG, SSN for US
        citizenshipCode: this.normalizeCountryCode(document.country),
        idDocType: document.documentType,
        idDocSubType: document.documentSubType,
      };

      this.logger.log(`✓ Processed ${docTypeDisplay} (ID: ${document.id}) - IDV: ${idvStatus}`);

      return completeDocumentInfo;
    } catch (contentError) {
      this.logger.error(`Failed to get content for document ${document.id}:`, contentError);
      return null;
    }
  }

  /**
   * LIVENESS CHECK VERIFICATION
   *
   * Determines if user passed liveness verification by checking for
   * documents with source "liveness" and GREEN review status
   */
  private checkLivenessResult(documents: any[]): ParticipantIDStatus {
    const livenessDocument = documents.find(
      (doc) => doc.uploadSource === 'liveness' && doc.verificationResult === 'GREEN',
    );

    return livenessDocument ? ParticipantIDStatus.PASS : ParticipantIDStatus.FAIL;
  }

  /**
   * DOCUMENT TYPE MAPPING
   *
   * Maps Sumsub document types to external provider-compatible formats
   * Supports: PASSPORT, DRIVERS, RESIDENCE_PERMIT only
   * Handles both US and non-US document types appropriately
   */
  private getIdNumberType(idDocType: IdentityDocType, country: string): string {
    if (idDocType === IdentityDocType.PASSPORT) {
      return country === 'US' ? 'us_passport' : 'non_us_passport';
    } else if (idDocType === IdentityDocType.DRIVERS) {
      return country === 'US' ? 'us_drivers_license' : 'non_us_other';
    } else if (idDocType === IdentityDocType.RESIDENCE_PERMIT) {
      return country === 'US' ? 'us_permanent_resident_card' : 'non_us_other';
    }

    // Default fallback for unsupported document types
    return country === 'US' ? 'us_drivers_license' : 'non_us_other';
  }

  /**
   * INDIVIDUAL DOCUMENT IDV STATUS
   *
   * Determines Identity Verification status for specific documents
   * Based on Sumsub's review results for each document
   */
  private determineIdvStatusForDocument(document: DocumentResource): ParticipantIDStatus {
    if (!document.verificationResult) {
      return ParticipantIDStatus.UNKNOWN;
    }

    return document.verificationResult.toLowerCase() === VerificationResult.GREEN.toLowerCase()
      ? ParticipantIDStatus.PASS
      : ParticipantIDStatus.FAIL;
  }
}
