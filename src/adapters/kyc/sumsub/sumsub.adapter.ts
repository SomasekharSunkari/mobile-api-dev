import { InternalServerErrorException, Logger, NotImplementedException } from '@nestjs/common';
import { AxiosResponse } from 'axios';
import { EnvironmentService } from '../../../config';
import { KycVerificationEnum } from '../../../database/models/kycVerification/kycVerification.interface';
import {
  DirectKYCInitiateResponse,
  DocumentResource,
  GenerateAccessTokenPayload,
  GenerateAccessTokenResponse,
  GenerateShareTokenPayload,
  GenerateShareTokenResponse,
  GetDocumentContentPayload,
  GetDocumentContentResponse,
  GetDocumentInfoPayload,
  GetDocumentInfoResponse,
  GetKycDetailsAdditionalIdDocument,
  GetKycDetailsAddress,
  GetKycDetailsIdDocument,
  GetKycDetailsPayload,
  GetKycDetailsResponse,
  IdentityDocSubType,
  IdentityDocType,
  InitiateWidgetKycPayload,
  KYCManagementInterface,
  KycBaseResponse,
  ParsedDocumentResponse,
  PerformAMLCheckPayload,
  PerformAMLCheckResponse,
  ProcessKycWebhookPayload,
  ProcessKycWebhookResponse,
  ResetApplicantPayload,
  ResetApplicantResponse,
  UpdateApplicantTaxInfoPayload,
  UpdateApplicantTaxInfoResponse,
  ValidateKycResponse,
  WidgetKYCInitiateResponse,
} from '../kyc-adapter.interface';
import { getOccupationDisplayName } from '../occupation-codes.mapping';
import { SumsubKycServiceAxiosHelper } from './sumsub.axios';
import {
  SumsubAMLCheckPayload,
  SumsubAMLCheckResponse,
  SumsubAddressKeyValue,
  SumsubApplicant,
  SumsubDocumentContentResponse,
  SumsubDocumentItem,
  SumsubDocumentMetadataResponse,
  SumsubFixedInfo,
  SumsubGenerateAccessTokenPayload,
  SumsubGenerateAccessTokenResponse,
  SumsubGenerateShareTokenPayload,
  SumsubGenerateShareTokenResponse,
  SumsubIdDoc,
  SumsubInfoAddress,
} from './sumsub.interface';

export class SumsubAdapter extends SumsubKycServiceAxiosHelper implements KYCManagementInterface {
  protected readonly logger = new Logger(SumsubAdapter.name);

  getFullInfo(userRef: string): Promise<KycBaseResponse<GetKycDetailsResponse>> {
    throw new NotImplementedException('Not Implemented', userRef);
  }

  async getKycDetails({ applicantId }: GetKycDetailsPayload): Promise<KycBaseResponse<GetKycDetailsResponse>> {
    this.logger.log('SumsubAdapter.getKycDetails', applicantId);
    try {
      const response = await this.get<{}, AxiosResponse<SumsubApplicant>>(`/resources/applicants/${applicantId}/one`);

      const data = response?.data;
      console.log('🚀 ~~ SumsubAdapter ~~ getKycDetails ~~ data:', data);

      const transformedData = this.transformKycDetails(data);
      console.log('🚀 ~~ SumsubAdapter ~~ getKycDetails ~~ transformedData:', transformedData);

      return {
        data: transformedData,
        message: 'SUCCESS',
        status: response.status,
      };
    } catch (error) {
      this.logger.error('SumsubAdapter.getKycDetails', error);
      throw new InternalServerErrorException(error?.message);
    }
  }

  private transformKycDetails(data: SumsubApplicant): GetKycDetailsResponse {
    this.logger.log('SumsubAdapter.transformKycDetails', data.externalUserId);

    // Get address from fixedInfo.addresses (not info.addresses)
    let address: GetKycDetailsAddress;
    const fixedInfo = data.fixedInfo?.addresses?.[0];
    if (fixedInfo) {
      address = this.getAddress(fixedInfo);
    }
    if (data.metadata) {
      address = this.getAddressFromMetadata(data.metadata, fixedInfo?.country);
    }

    const info = data.info ?? data.fixedInfo;

    // Get first ID document
    const firstIdDoc = data.info?.idDocs?.[0];

    // Get status information
    const statusInfo = this.getKycDetailsStatus(data.review);

    // Get agreement accepted timestamp
    const agreementAcceptedAt = data.agreement?.items?.[0]?.acceptedAt;

    // Extract questionnaire data for EDD fields
    const questionnaire = data.questionnaires?.find((q) => q.id === 'financial_informations');
    const financialInfo = questionnaire?.sections?.dffddd?.items;

    // get the additional id documents (Including NIN).
    const additionalIdDocuments = this.transformAdditionalIdDocuments(data);

    return {
      address,
      country: info.country,
      dob: EnvironmentService.isProduction() ? firstIdDoc.dob : info?.dob,
      email: data.email,
      firstName: firstIdDoc?.firstName || data.info?.firstName,
      lastName: firstIdDoc?.lastName || data.info?.lastName,
      middleName: firstIdDoc?.middleName || data.info?.middleName,
      id: data.id,
      referenceId: data.inspectionId,
      idNumber: data.fixedInfo?.tin, // TIN is in fixedInfo, not info
      idDocument: firstIdDoc ? this.getKycDetailsIdDocument(firstIdDoc) : undefined,
      agreementAcceptedAt,
      userId: data.externalUserId,
      phone: data.phone,
      status: statusInfo.status,
      errorMessage: statusInfo.errorMessage,
      failureReason: statusInfo.failureReason,
      failureCorrection: statusInfo.failureCorrections,
      platform: data.applicantPlatform,
      submittedAt: data.createdAt,
      reviewedAt: data.review?.reviewDate,
      completedAt: data.createdAt,
      approvedAt: agreementAcceptedAt,
      accountPurpose: financialInfo?.account_purpose?.value,
      mostRecentOccupation: financialInfo?.most_recent_occupation?.value
        ? getOccupationDisplayName(financialInfo.most_recent_occupation.value)
        : undefined,
      employmentStatus: financialInfo?.employment_status?.value,
      sourceOfFunds: financialInfo?.source_of_funds?.value,
      expectedMonthlyPaymentsUsd: financialInfo?.expected_monthly_payments_usd?.value,
      additionalIdDocuments: additionalIdDocuments,
    };
  }

  private transformAdditionalIdDocuments(data: SumsubApplicant): GetKycDetailsAdditionalIdDocument[] {
    const additionalDocuments: GetKycDetailsAdditionalIdDocument[] = [];
    const userCountry = data.info?.country?.toLowerCase();

    for (const idDoc of data.info?.idDocs ?? []) {
      if (userCountry === 'nga' && idDoc.idDocType.toUpperCase() === 'ID_CARD') {
        additionalDocuments.push({
          country_code: idDoc.country,
          type: IdentityDocType.NIN,
          number: idDoc.number,
          validUntil: idDoc.validUntil,
        });
      } else {
        additionalDocuments.push({
          country_code: idDoc.country,
          type: idDoc.idDocType as IdentityDocType,
          number: idDoc.number,
          validUntil: idDoc.validUntil,
        });
      }
    }

    return additionalDocuments;
  }

  private getKycDetailsStatus(review: SumsubApplicant['review']): {
    status: KycVerificationEnum;
    errorMessage?: string;
    failureReason?: string;
    failureCorrections?: string;
  } {
    const isInitialized = review.reviewStatus === 'init';
    const isCompleted = review.reviewStatus === 'completed' && review.reviewResult.reviewAnswer === 'GREEN';
    const isOnHold = review.reviewStatus === 'onHold';
    const isPending = review.reviewStatus === 'pending';
    const isRejected =
      review.reviewStatus === 'completed' &&
      review.reviewResult.reviewAnswer === 'RED' &&
      review.reviewResult?.reviewRejectType === 'FINAL';
    const isTemporaryRejected =
      review.reviewStatus === 'completed' &&
      review.reviewResult.reviewAnswer === 'RED' &&
      review.reviewResult?.reviewRejectType === 'RETRY';

    const errorMessage = review.reviewResult?.moderationComment;
    const clientComment = review.reviewResult?.clientComment;
    const rejectLabels = review.reviewResult?.rejectLabels;

    let failureReason: string | undefined = undefined;
    const failureCorrections: string | undefined = review.reviewResult?.moderationComment;

    if (!failureReason && errorMessage) {
      failureReason = errorMessage;
    }

    if (isRejected || isTemporaryRejected) {
      failureReason = clientComment;

      if (!failureReason && rejectLabels && rejectLabels.length > 0) {
        failureReason = this.formatRejectLabels(rejectLabels);
      }
    }

    if (isInitialized) {
      return { status: KycVerificationEnum.NOT_STARTED, errorMessage };
    }
    if (isCompleted) {
      return { status: KycVerificationEnum.APPROVED, errorMessage };
    }
    if (isOnHold) {
      return { status: KycVerificationEnum.IN_REVIEW, errorMessage };
    }
    if (isPending) {
      return { status: KycVerificationEnum.PENDING, errorMessage };
    }
    if (isRejected) {
      return { status: KycVerificationEnum.REJECTED, errorMessage, failureReason, failureCorrections };
    }
    if (isTemporaryRejected) {
      return { status: KycVerificationEnum.REJECTED, errorMessage, failureReason, failureCorrections };
    }
  }

  private formatRejectLabels(labels: string[]): string {
    const labelMapping: Record<string, string> = {
      // Resubmission requested labels (RETRY)
      ADDITIONAL_DOCUMENT_REQUIRED: 'Additional document required',
      ADVERSE_MEDIA_SUSPECTED: 'Adverse media suspected',
      APPLICANT_INTERRUPTED_INTERVIEW: 'Applicant did not finish the interview',
      BAD_AVATAR: 'Avatar quality is poor',
      BAD_DOCUMENT: 'Document quality is poor',
      BAD_FACE_MATCHING: 'Face on selfie cannot be matched with ID document',
      BAD_PROOF_OF_IDENTITY: 'Proof of identity is inadequate',
      BAD_PROOF_OF_PAYMENT: 'Proof of payment is inadequate',
      BAD_SELFIE: 'Selfie quality is poor',
      BAD_VIDEO_SELFIE: 'Video selfie check failed',
      BLACK_AND_WHITE: 'Black and white documents are not accepted',
      BLURRY: 'Document or photo is blurry',
      COMPANY_DATA_MISMATCH: 'Company data does not match the provided documents',
      COMPANY_NOT_DEFINED_BENEFICIARIES: 'Beneficiaries are not defined',
      COMPANY_NOT_DEFINED_REPRESENTATIVES: 'Representatives are not defined',
      COMPANY_NOT_DEFINED_STRUCTURE: 'Could not establish the entity control structure',
      COMPANY_NOT_VALIDATED_BENEFICIARIES: 'Beneficiaries are not validated',
      COMPANY_NOT_VALIDATED_REPRESENTATIVES: 'Representatives are not validated',
      CONNECTION_INTERRUPTED: 'Video identification call connection was interrupted',
      DIGITAL_DOCUMENT: 'Digital version of the document is not acceptable',
      DOCUMENT_DAMAGED: 'Document is damaged',
      DOCUMENT_DEPRIVED: 'Applicant has been deprived of the document',
      DOCUMENT_MISSING: 'Required documents were not provided',
      DOCUMENT_PAGE_MISSING: 'Some pages of the document are missing',
      EXPIRATION_DATE: 'Document has expired',
      FRONT_SIDE_MISSING: 'Front side of the document is missing',
      GRAPHIC_EDITOR: 'Document was processed in a graphic editor',
      ID_INVALID: 'Document is not valid',
      INCOMPATIBLE_LANGUAGE: 'Document translation is required',
      INCOMPLETE_DOCUMENT: 'Document is incomplete or partially visible',
      INCORRECT_SOCIAL_NUMBER: 'Social security number is incorrect',
      LOW_QUALITY: 'Image quality is too low',
      NOT_ALL_CHECKS_COMPLETED: 'All checks have not been completed',
      NOT_READABLE: 'Document is not readable',
      OUTDATED_DOCUMENT_VERSION: 'Document is not the most recent version',
      PROBLEMATIC_APPLICANT_DATA: 'Applicant data does not match the data in the documents',
      REQUESTED_DATA_MISMATCH: 'Provided information does not match the document',
      RESTRICTED_PERSON: 'Applicant is subject to restrictions',
      SCREENSHOTS: 'Screenshots are not acceptable',
      SELFIE_WITH_PAPER: 'Special selfie with paper and date is required',
      UNFILLED_ID: 'Document is missing required signatures and stamps',
      UNSATISFACTORY_PHOTOS: 'Photo quality is unsatisfactory',
      UNSUITABLE_DOCUMENT: 'Document is unsuitable for verification',
      UNSUITABLE_ENV: 'Verification environment is unsuitable',
      WRONG_ADDRESS: 'Address from documents does not match provided address',

      // Rejected labels (FINAL)
      ADVERSE_MEDIA: 'Applicant was found in adverse media',
      AGE_REQUIREMENT_MISMATCH: 'Age requirement is not met',
      BLOCKLIST: 'Applicant is blocklisted',
      CHECK_UNAVAILABLE: 'Database check is not available',
      COMPANY_PROBLEMATIC_STRUCTURE: 'Company structure has problematic officials',
      COMPROMISED_PERSONS: 'Applicant does not meet security requirements',
      CRIMINAL: 'Applicant is involved in illegal actions',
      DB_DATA_MISMATCH: 'Data mismatch; profile could not be verified',
      DB_DATA_NOT_FOUND: 'No data was found; profile could not be verified',
      DEEPFAKE: 'Attempt to bypass liveness check with deepfake detected',
      DOCUMENT_TEMPLATE: 'Documents are templates downloaded from the internet',
      DUPLICATE: 'Applicant already exists and duplicates are not allowed',
      EXPERIENCE_REQUIREMENT_MISMATCH: 'Required experience level not met',
      EXTERNAL_DECISION_REJECTION: 'Applicant was rejected by external decision',
      FALSE_IDENTITY: 'Risk of applicant faking their identity',
      FALSE_IDENTITY_DOCUMENT: 'Risk that the identity document is fake',
      FITNESS_PROBITY: 'Applicant found on fitness and probity lists',
      FORCED_VERIFICATION: 'Forced verification suspected',
      FORGERY: 'Forgery attempt detected',
      FRAUDULENT_LIVENESS: 'Attempt to bypass liveness check detected',
      FRAUDULENT_PATTERNS: 'Fraudulent behavior detected',
      HIGH_RISK_PROFILE: 'High risk profile detected based on anomalies',
      INCONSISTENT_PROFILE: 'Data or documents from different persons detected',
      NOT_DOCUMENT: 'Documents supplied are not relevant for verification',
      PEP: 'Applicant belongs to the PEP category',
      PRINTED_ID_COPY: 'Applicant provided a printed copy of document',
      REGULATIONS_VIOLATIONS: 'Regulatory violations detected',
      SANCTIONS: 'Applicant was found on sanction lists',
      SELFIE_MISMATCH: 'Applicant photo does not match document photo',
      SPAM: 'Verification attempt was spam or created by mistake',
      SUSPICIOUS_PATTERNS: 'Suspicious patterns detected indicating non-genuine verification attempt',
      THIRD_PARTY_INVOLVED: 'Third party involvement detected',
      UNSUPPORTED_LANGUAGE: 'Language is not supported for video identification',
      WRONG_USER_REGION: 'Applicant is from an unsupported region',
    };

    const formattedLabels = labels
      .map((label) => labelMapping[label] || label.toLowerCase().replace(/_/g, ' '))
      .join(', ');

    return formattedLabels;
  }

  private getKycDetailsIdDocument(idDocument: SumsubIdDoc): GetKycDetailsIdDocument {
    return {
      type: idDocument.idDocType.toLowerCase(),
      number: idDocument.number,
      validUntil: idDocument.validUntil,
    };
  }

  private getAddressFromMetadata(metadata: SumsubAddressKeyValue[], country: string): GetKycDetailsAddress {
    const street = metadata.find((item) => item.key === 'Street')?.value;
    const city = metadata.find((item) => item.key === 'City')?.value;
    const state = metadata.find((item) => item.key === 'State')?.value;
    const postalCode = metadata.find((item) => item.key === 'Postcode')?.value;
    const address = `${street}, ${city}, ${state}, ${country}`;

    return {
      address: address,
      city: city,
      postalCode: postalCode,
      state: state,
      country: country,
    };
  }

  private getAddress(address: SumsubInfoAddress): GetKycDetailsAddress {
    return {
      address: address.street,
      address2: address.subStreet,
      city: address.town,
      postalCode: address.postCode,
      state: address.state,
      country: address.country,
    };
  }

  async processWebhook(payload: ProcessKycWebhookPayload): Promise<KycBaseResponse<ProcessKycWebhookResponse>> {
    this.logger.log('SumsubAdapter.processWebhook', payload.applicantId);

    const response = await this.getKycDetails(payload);

    return {
      data: {
        type: payload.type,
        kycStatus: response.data.status,
        kycDetails: response.data,
        rejectReason: response.data.errorMessage,
      },
      message: 'SUCCESS',
      status: response.status,
    };
  }

  verifySignature(): boolean {
    throw new NotImplementedException('Not implemented');
  }

  async generateAccessToken(data: GenerateAccessTokenPayload): Promise<KycBaseResponse<GenerateAccessTokenResponse>> {
    this.logger.log('SumsubAdapter.generateAccessToken', data.applicantIdentifier);
    try {
      const response = await this.post<
        SumsubGenerateAccessTokenPayload,
        AxiosResponse<SumsubGenerateAccessTokenResponse>,
        SumsubGenerateAccessTokenPayload
      >('/resources/accessTokens/sdk', { ...data, levelName: data.verificationType });

      return {
        data: {
          kycVerificationType: data.verificationType,
          token: response?.data?.token,
          userId: data.userId,
        },
        message: 'SUCCESS',
        status: response.status,
      };
    } catch (error) {
      this.logger.error('SumsubAdapter.generateAccessToken', error);
      throw new InternalServerErrorException(error?.message);
    }
  }

  async generateShareToken(data: GenerateShareTokenPayload): Promise<KycBaseResponse<GenerateShareTokenResponse>> {
    this.logger.log('SumsubAdapter.generateShareToken', data.applicantId);
    try {
      const response = await this.post<
        SumsubGenerateShareTokenPayload,
        AxiosResponse<SumsubGenerateShareTokenResponse>,
        SumsubGenerateShareTokenPayload
      >('/resources/accessTokens/shareToken', data);

      return {
        data: response.data,
        message: 'SUCCESS',
        status: response.status,
      };
    } catch (error) {
      this.logger.error('SumsubAdapter.generateShareToken', error);
      throw new InternalServerErrorException(error?.message);
    }
  }

  async getKycDetailsByUserId(userId: string): Promise<KycBaseResponse<GetKycDetailsResponse>> {
    this.logger.log('SumsubAdapter.getKycDetailsByUserId', userId);
    try {
      const response = await this.get<{}, AxiosResponse<SumsubApplicant>>(
        `/resources/applicants/-;externalUserId=${userId}/one`,
      );

      const transformedData = this.transformKycDetails(response.data);

      return {
        data: transformedData,
        message: 'SUCCESS',
        status: response.status,
      };
    } catch (error) {
      this.logger.error('SumsubAdapter.getKycDetailsByUserId', error);
      throw new InternalServerErrorException(error?.message);
    }
  }

  async performAMLCheck(payload: PerformAMLCheckPayload): Promise<KycBaseResponse<PerformAMLCheckResponse>> {
    this.logger.log('SumsubAdapter.performAMLCheck', payload.applicantId);
    try {
      const response = await this.post<SumsubAMLCheckPayload, AxiosResponse<SumsubAMLCheckResponse>>(
        `/resources/applicants/${payload.applicantId}/recheck/aml`,
        payload,
      );

      const isSuccess = response.data.ok === 1;

      return { data: response.data, message: isSuccess ? 'SUCCESS' : 'FAILED', status: isSuccess ? 200 : 400 };
    } catch (error) {
      this.logger.error('SumsubAdapter.performAMLCheck', error);
      throw new InternalServerErrorException(error?.message);
    }
  }

  async initiateWidgetKyc(payload: InitiateWidgetKycPayload): Promise<WidgetKYCInitiateResponse> {
    this.logger.log('SumsubAdapter.initiateWidgetKyc');

    try {
      const accessToken = await this.generateAccessToken({
        applicantIdentifier: {
          email: payload.email,
          phone: payload.phoneNumber,
        },
        verificationType: payload.kycVerificationType,
        userId: payload.userId,
      });

      return {
        token: accessToken.data.token,
        userId: accessToken.data.userId,
        kycVerificationType: payload.kycVerificationType,
      };
    } catch (error) {
      this.logger.error('SumsubAdapter.initiateWidgetKyc', error);
      throw new InternalServerErrorException(error?.message);
    }
  }

  async initiateDirectKyc(): Promise<DirectKYCInitiateResponse> {
    this.logger.log('SumsubAdapter.initiateDirectKyc');
    throw new NotImplementedException('Not implemented');
  }

  async validateKyc(): Promise<ValidateKycResponse> {
    this.logger.log('SumsubAdapter.validateKyc');
    throw new NotImplementedException('Not implemented');
  }

  async getDocumentInfo({ applicantId }: GetDocumentInfoPayload): Promise<KycBaseResponse<GetDocumentInfoResponse>> {
    this.logger.log('SumsubAdapter.getDocumentInfo', applicantId);
    try {
      const response = await this.get<{}, AxiosResponse<SumsubDocumentMetadataResponse>>(
        `/resources/applicants/${applicantId}/metadata/resources`,
      );

      const data = response?.data;
      const transformedData = this.transformDocumentInfo(applicantId, data);

      return {
        data: transformedData,
        message: 'SUCCESS',
        status: response.status,
      };
    } catch (error) {
      this.logger.error('SumsubAdapter.getDocumentInfo', error);
      throw new InternalServerErrorException(error?.message);
    }
  }

  private transformDocumentInfo(applicantId: string, data: SumsubDocumentMetadataResponse): GetDocumentInfoResponse {
    this.logger.log('SumsubAdapter.transformDocumentInfo', applicantId);

    this.logger.log(`Found ${data.items?.length || 0} raw documents from Sumsub`);

    const documents: DocumentResource[] = [];

    if (data.items) {
      for (const item of data.items) {
        if (this.isSupportedDocumentType(item)) {
          const processedDocument = this.processDocumentItem(item);
          documents.push(processedDocument);
        } else {
          this.logger.debug(
            `Skipping unsupported document type: ${item.idDocDef?.idDocType}/${item.idDocDef?.idDocSubType} for item ${item.id}`,
          );
        }
      }
    }

    const transformedTypes = documents.map((doc) => `${doc.documentType} ${doc.documentSubType || ''}`.trim());
    this.logger.log(
      `Transformed ${documents.length} documents for external processing: [${transformedTypes.join(', ')}]`,
    );

    return {
      applicantId,
      documents,
    };
  }

  /**
   * Check if a document type is supported for processing
   */
  private isSupportedDocumentType(item: SumsubDocumentItem): boolean {
    if (!item.idDocDef) {
      return false;
    }

    const idDocType = item.idDocDef.idDocType;
    const idDocSubType = item.idDocDef.idDocSubType;

    // Support DRIVERS and RESIDENCE_PERMIT with specific subtypes
    if (
      (idDocType === IdentityDocType.DRIVERS || idDocType === IdentityDocType.RESIDENCE_PERMIT) &&
      (idDocSubType === IdentityDocSubType.FRONT_SIDE || idDocSubType === IdentityDocSubType.BACK_SIDE)
    ) {
      return true;
    }

    // Support PASSPORT and SELFIE without subtype requirement
    if (idDocType === IdentityDocType.PASSPORT || idDocType === IdentityDocType.SELFIE) {
      return true;
    }

    return false;
  }

  /**
   * Process a document item into a DocumentResource
   * This method should only be called after isSupportedDocumentType returns true
   */
  private processDocumentItem(item: SumsubDocumentItem): DocumentResource {
    // Validate that essential document definition exists
    if (!item.idDocDef) {
      this.logger.error(`Document item missing idDocDef: ${JSON.stringify(item)}`);
      throw new InternalServerErrorException(
        `Document item ${item.id} is missing essential document definition (idDocDef)`,
      );
    }

    const idDocType = item.idDocDef.idDocType;
    const idDocSubType = item.idDocDef.idDocSubType;

    const baseDocument = {
      id: item.id,
      documentType: idDocType as IdentityDocType,
      country: item.idDocDef.country,
      uploadSource: item.source,
      verificationResult: item.reviewResult?.reviewAnswer,
      originalFileName: item.fileMetadata?.fileName,
      mimeType: item.fileMetadata?.fileType,
      lastUpdatedAt: new Date(item.addedDate).getTime(),
    };

    // Include both sides for DRIVERS and RESIDENCE_PERMIT
    if (
      (idDocType === IdentityDocType.DRIVERS || idDocType === IdentityDocType.RESIDENCE_PERMIT) &&
      (idDocSubType === IdentityDocSubType.FRONT_SIDE || idDocSubType === IdentityDocSubType.BACK_SIDE)
    ) {
      return { ...baseDocument, documentSubType: idDocSubType as IdentityDocSubType };
    }

    // Include PASSPORT and SELFIE without subtype
    if (idDocType === IdentityDocType.PASSPORT || idDocType === IdentityDocType.SELFIE) {
      return baseDocument;
    }

    // This should never happen if isSupportedDocumentType was called first
    throw new InternalServerErrorException(
      `Attempting to process unsupported document type: ${idDocType}/${idDocSubType} for item ${item.id}`,
    );
  }

  async getDocumentContent({
    referenceId,
    documentId,
  }: GetDocumentContentPayload): Promise<KycBaseResponse<GetDocumentContentResponse>> {
    this.logger.log('SumsubAdapter.getDocumentContent', referenceId, documentId);
    try {
      // Sumsub endpoint to get document content - returns raw binary data
      const response = await this.get<{}, AxiosResponse<Buffer>>(
        `/resources/inspections/${referenceId}/resources/${documentId}`,
      );

      this.logger.log('Document content response info:', {
        status: response.status,
        contentType: response.headers['content-type'],
        contentLength: response.headers['content-length'],
        dataType: typeof response.data,
        dataLength: response.data.length,
      });

      // Convert Buffer response to base64 content
      const { content, mimeType, fileName } = this.parseDocumentResponse(
        {
          data: response.data,
          headers: {
            'content-type': response.headers['content-type'] || 'application/octet-stream',
            'content-length': response.headers['content-length'],
          },
        },
        documentId,
      );

      return {
        data: {
          documentId,
          content,
          mimeType,
          fileName,
        },
        message: 'SUCCESS',
        status: response.status,
      };
    } catch (error) {
      this.logger.error('SumsubAdapter.getDocumentContent', error);
      throw new InternalServerErrorException(error?.message);
    }
  }

  supportedCountries(): string[] {
    return ['US', 'NG'];
  }

  /**
   * Parse document response from Sumsub API into standardized format
   * Sumsub returns raw binary data (Buffer) for document content
   */
  private parseDocumentResponse(response: SumsubDocumentContentResponse, documentId: string): ParsedDocumentResponse {
    const contentType = response.headers['content-type'];

    // Determine file extension based on content type
    let fileExtension = 'bin';
    if (contentType.startsWith('image/jpeg')) {
      fileExtension = 'jpg';
    } else if (contentType.startsWith('image/png')) {
      fileExtension = 'png';
    } else if (contentType.startsWith('application/pdf')) {
      fileExtension = 'pdf';
    } else if (contentType.startsWith('image/')) {
      fileExtension = 'jpg'; // Default for other image types
    }

    return {
      content: response.data.toString('base64'),
      mimeType: contentType,
      fileName: `document_${documentId}.${fileExtension}`,
    };
  }

  async resetApplicant(payload: ResetApplicantPayload): Promise<KycBaseResponse<ResetApplicantResponse>> {
    try {
      this.logger.log(`Resetting applicant: ${payload.applicantId}`);

      await this.post(`/resources/applicants/${payload.applicantId}/reset`, {});

      return {
        data: { ok: 1 },
        message: 'SUCCESS',
        status: 200,
      };
    } catch (error) {
      this.logger.error('SumsubAdapter.resetApplicant', error);
      throw new InternalServerErrorException(error?.message || 'Failed to reset applicant');
    }
  }

  async updateApplicantTaxInfo(
    payload: UpdateApplicantTaxInfoPayload,
  ): Promise<KycBaseResponse<UpdateApplicantTaxInfoResponse>> {
    try {
      this.logger.log(`Updating tax info for applicant: ${payload.applicantId}`);

      const body = {
        tin: payload.tin || '',
      };

      await this.patch(`/resources/applicants/${payload.applicantId}/fixedInfo`, body);

      return {
        data: { ok: 1 },
        message: 'SUCCESS',
        status: 200,
      };
    } catch (error) {
      this.logger.error('SumsubAdapter.updateApplicantTaxInfo', error);
      throw new InternalServerErrorException(error?.message || 'Failed to update tax info');
    }
  }

  async updateApplicantFixedInfo(applicantId: string, payload: Partial<SumsubFixedInfo>): Promise<SumsubFixedInfo> {
    try {
      this.logger.log(`Updating applicant fixed info: ${applicantId} with payload: ${JSON.stringify(payload)}`);

      const response = await this.patch<SumsubFixedInfo, AxiosResponse<SumsubFixedInfo>>(
        `/resources/applicants/${applicantId}/fixedInfo`,
        payload,
      );
      console.log('🚀 ~~ SumsubAdapter ~~ updateApplicantFixedInfo  ~~ response:', response.data);

      return response.data;
    } catch (error) {
      this.logger.error('SumsubAdapter.updateApplicantFixedInfo', error);
      throw new InternalServerErrorException(error?.message);
    }
  }

  async getKycDetailsByUserIdWithTransform(userId: string): Promise<SumsubApplicant> {
    this.logger.log('SumsubAdapter.getKycDetailsByUserId', userId);
    try {
      const response = await this.get<{}, AxiosResponse<SumsubApplicant>>(
        `/resources/applicants/-;externalUserId=${userId}/one`,
      );

      return response.data;
    } catch (error) {
      this.logger.error('SumsubAdapter.getKycDetailsByUserId', error);
      throw new InternalServerErrorException(error?.message);
    }
  }
}
