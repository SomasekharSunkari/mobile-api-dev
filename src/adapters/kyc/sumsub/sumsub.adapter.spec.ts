import { InternalServerErrorException, NotImplementedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import axios, { AxiosResponse } from 'axios';
import { SumsubConfigProvider } from '../../../config/sumsub.config';
import { KycVerificationEnum } from '../../../database/models/kycVerification/kycVerification.interface';
import { GenerateAccessTokenPayload, GetKycDetailsPayload, ProcessKycWebhookPayload } from '../kyc-adapter.interface';
import { SumsubAdapter } from './sumsub.adapter';

describe('SumsubAdapter', () => {
  let adapter: SumsubAdapter;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: SumsubAdapter,
          useFactory: () => {
            const adapter = new SumsubAdapter(axios, new SumsubConfigProvider().getConfig());
            // Mock the base class methods
            jest.spyOn(adapter, 'get').mockImplementation(jest.fn());
            jest.spyOn(adapter, 'post').mockImplementation(jest.fn());
            jest.spyOn(adapter, 'patch').mockImplementation(jest.fn());
            return adapter;
          },
        },
      ],
    }).compile();

    adapter = module.get<SumsubAdapter>(SumsubAdapter);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getFullInfo', () => {
    it('should throw NotImplementedException', () => {
      const userRef = 'TEST123';
      expect(() => adapter.getFullInfo(userRef)).toThrow(NotImplementedException);
    });
  });

  describe('getKycDetails', () => {
    const mockPayload: GetKycDetailsPayload = {
      applicantId: 'APP123',
    };

    const mockApplicant = {
      id: 'APP123',
      createdAt: '2024-03-20T10:00:00Z',
      clientId: 'CLIENT123',
      inspectionId: 'INSP123',
      externalUserId: 'USER123',
      email: 'john.doe@example.com',
      phone: '+1234567890',
      applicantPlatform: 'web',
      agreement: {
        items: [
          {
            id: 'AGR123',
            acceptedAt: '2024-03-20T10:05:00Z',
            source: 'web',
            type: 'default',
            recordIds: [],
          },
        ],
        createdAt: '2024-03-20T10:00:00Z',
        source: 'web',
        recordIds: [],
      },
      fixedInfo: {
        dob: '1990-01-01',
        country: 'Nigeria',
        residenceCountry: 'Nigeria',
        tin: 'A12345678',
        addresses: [
          {
            subStreet: 'Apt 123',
            subStreetEn: 'Apt 123',
            street: 'Main Street',
            streetEn: 'Main Street',
            state: 'Lagos',
            stateEn: 'Lagos',
            stateCode: 'LA',
            town: 'Lagos',
            townEn: 'Lagos',
            postCode: '100001',
            country: 'Nigeria',
            formattedAddress: 'Apt 123, Main Street, Lagos, Nigeria',
          },
        ],
      },
      info: {
        firstName: 'John',
        firstNameEn: 'John',
        middleName: '',
        middleNameEn: '',
        lastName: 'Doe',
        lastNameEn: 'Doe',
        dob: '1990-01-01',
        country: 'Nigeria',
        idDocs: [
          {
            idDocType: 'PASSPORT',
            country: 'Nigeria',
            firstName: 'John',
            firstNameEn: 'John',
            middleName: '',
            middleNameEn: '',
            lastName: 'Doe',
            lastNameEn: 'Doe',
            validUntil: '2030-01-01',
            number: 'A12345678',
            dob: '1990-01-01',
          },
        ],
        addresses: [
          {
            subStreet: 'Apt 123',
            subStreetEn: 'Apt 123',
            street: 'Main Street',
            streetEn: 'Main Street',
            state: 'Lagos',
            stateEn: 'Lagos',
            stateCode: 'LA',
            town: 'Lagos',
            townEn: 'Lagos',
            postCode: '100001',
            country: 'Nigeria',
            formattedAddress: 'Apt 123, Main Street, Lagos, Nigeria',
          },
        ],
      },
      requiredIdDocs: {
        docSets: [],
      },
      review: {
        reviewId: 'REV123',
        attemptId: 'ATT123',
        attemptCnt: 1,
        elapsedSincePendingMs: 300000,
        elapsedSinceQueuedMs: 60000,
        reprocessing: false,
        levelName: 'basic-kyc-level',
        levelAutoCheckMode: 'AUTO',
        createDate: '2024-03-20T10:00:00Z',
        reviewDate: '2024-03-20T10:30:00Z',
        reviewResult: {
          reviewAnswer: 'GREEN',
          moderationComment: 'Approved',
          clientComment: null,
        },
        reviewStatus: 'completed',
        priority: 1,
      },
      lang: 'en',
      type: 'INDIVIDUAL',
    };

    const mockResponse: AxiosResponse = {
      data: mockApplicant,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    };

    it('should successfully get KYC details', async () => {
      (adapter.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await adapter.getKycDetails(mockPayload);

      expect(result).toEqual({
        data: {
          id: 'APP123',
          userId: 'USER123',
          referenceId: 'INSP123',
          firstName: 'John',
          lastName: 'Doe',
          middleName: '',
          dob: '1990-01-01',
          country: 'Nigeria',
          email: 'john.doe@example.com',
          phone: '+1234567890',
          address: {
            address: 'Main Street',
            address2: 'Apt 123',
            city: 'Lagos',
            country: 'Nigeria',
            postalCode: '100001',
            state: 'Lagos',
          },
          idNumber: 'A12345678',
          idDocument: {
            type: 'passport',
            number: 'A12345678',
            validUntil: '2030-01-01',
          },
          status: KycVerificationEnum.APPROVED,
          errorMessage: 'Approved',
          failureReason: undefined,
          failureCorrection: undefined,
          agreementAcceptedAt: '2024-03-20T10:05:00Z',
          platform: 'web',
          submittedAt: '2024-03-20T10:00:00Z',
          reviewedAt: '2024-03-20T10:30:00Z',
          completedAt: '2024-03-20T10:00:00Z',
          approvedAt: '2024-03-20T10:05:00Z',
          accountPurpose: undefined,
          mostRecentOccupation: undefined,
          employmentStatus: undefined,
          sourceOfFunds: undefined,
          expectedMonthlyPaymentsUsd: undefined,
          additionalIdDocuments: [
            {
              country_code: 'Nigeria',
              type: 'PASSPORT',
              number: 'A12345678',
              validUntil: '2030-01-01',
            },
          ],
        },
        message: 'SUCCESS',
        status: 200,
      });
      expect(adapter.get).toHaveBeenCalledWith(`/resources/applicants/${mockPayload.applicantId}/one`);
    });

    it('should handle error when getting KYC details', async () => {
      const error = new Error('Failed to get KYC details');
      (adapter.get as jest.Mock).mockRejectedValue(error);

      await expect(adapter.getKycDetails(mockPayload)).rejects.toThrow(InternalServerErrorException);
    });

    it('should extract EDD fields from questionnaire data', async () => {
      const mockApplicantWithQuestionnaire = {
        ...mockApplicant,
        questionnaires: [
          {
            id: 'financial_informations',
            sections: {
              dffddd: {
                score: 100,
                items: {
                  account_purpose: { value: 'personal_use' },
                  most_recent_occupation: { value: '151252' }, // Software developer code
                  employment_status: { value: 'employed' },
                  source_of_funds: { value: 'salary' },
                  expected_monthly_payments_usd: { value: '5000' },
                },
              },
            },
            score: 100,
          },
        ],
      };

      const mockResponseWithQuestionnaire: AxiosResponse = {
        ...mockResponse,
        data: mockApplicantWithQuestionnaire,
      };

      (adapter.get as jest.Mock).mockResolvedValue(mockResponseWithQuestionnaire);

      const result = await adapter.getKycDetails(mockPayload);

      expect(result.data).toMatchObject({
        accountPurpose: 'personal_use',
        mostRecentOccupation: 'Software developer',
        employmentStatus: 'employed',
        sourceOfFunds: 'salary',
        expectedMonthlyPaymentsUsd: '5000',
        additionalIdDocuments: [
          {
            country_code: 'Nigeria',
            type: 'PASSPORT',
            number: 'A12345678',
            validUntil: '2030-01-01',
          },
        ],
      });
    });

    it('should handle missing questionnaire data gracefully', async () => {
      const mockApplicantWithoutQuestionnaire = {
        ...mockApplicant,
        questionnaires: undefined,
      };

      const mockResponseWithoutQuestionnaire: AxiosResponse = {
        ...mockResponse,
        data: mockApplicantWithoutQuestionnaire,
      };

      (adapter.get as jest.Mock).mockResolvedValue(mockResponseWithoutQuestionnaire);

      const result = await adapter.getKycDetails(mockPayload);

      expect(result.data).toMatchObject({
        accountPurpose: undefined,
        mostRecentOccupation: undefined,
        employmentStatus: undefined,
        sourceOfFunds: undefined,
        expectedMonthlyPaymentsUsd: undefined,
      });
    });

    it('should handle invalid occupation code gracefully', async () => {
      const mockApplicantWithInvalidOccupation = {
        ...mockApplicant,
        questionnaires: [
          {
            id: 'financial_informations',
            sections: {
              dffddd: {
                score: 100,
                items: {
                  most_recent_occupation: { value: 'INVALID_CODE' },
                  employment_status: { value: 'employed' },
                },
              },
            },
            score: 100,
          },
        ],
      };

      const mockResponseWithInvalidOccupation: AxiosResponse = {
        ...mockResponse,
        data: mockApplicantWithInvalidOccupation,
      };

      (adapter.get as jest.Mock).mockResolvedValue(mockResponseWithInvalidOccupation);

      const result = await adapter.getKycDetails(mockPayload);

      expect(result.data.mostRecentOccupation).toBeUndefined();
      expect(result.data.employmentStatus).toBe('employed');
    });

    it('should prioritize ID document names over info names', async () => {
      const mockApplicantWithDifferentNames = {
        ...mockApplicant,
        info: {
          ...mockApplicant.info,
          firstName: 'InfoFirstName',
          lastName: 'InfoLastName',
          middleName: 'InfoMiddleName',
          idDocs: [
            {
              ...mockApplicant.info.idDocs[0],
              firstName: 'DocFirstName',
              lastName: 'DocLastName',
              middleName: 'DocMiddleName',
            },
          ],
        },
      };

      const mockResponseWithDifferentNames: AxiosResponse = {
        ...mockResponse,
        data: mockApplicantWithDifferentNames,
      };

      (adapter.get as jest.Mock).mockResolvedValue(mockResponseWithDifferentNames);

      const result = await adapter.getKycDetails(mockPayload);

      expect(result.data.firstName).toBe('DocFirstName');
      expect(result.data.lastName).toBe('DocLastName');
      expect(result.data.middleName).toBe('DocMiddleName');
    });

    it('should fallback to info names when ID document names are missing', async () => {
      const mockApplicantWithoutDocNames = {
        ...mockApplicant,
        info: {
          ...mockApplicant.info,
          firstName: 'InfoFirstName',
          lastName: 'InfoLastName',
          middleName: 'InfoMiddleName',
          idDocs: [
            {
              ...mockApplicant.info.idDocs[0],
              firstName: undefined,
              lastName: undefined,
              middleName: undefined,
            },
          ],
        },
      };

      const mockResponseWithoutDocNames: AxiosResponse = {
        ...mockResponse,
        data: mockApplicantWithoutDocNames,
      };

      (adapter.get as jest.Mock).mockResolvedValue(mockResponseWithoutDocNames);

      const result = await adapter.getKycDetails(mockPayload);

      expect(result.data.firstName).toBe('InfoFirstName');
      expect(result.data.lastName).toBe('InfoLastName');
      expect(result.data.middleName).toBe('InfoMiddleName');
    });

    it('should handle partial ID document names with fallback to info', async () => {
      const mockApplicantWithPartialDocNames = {
        ...mockApplicant,
        info: {
          ...mockApplicant.info,
          firstName: 'InfoFirstName',
          lastName: 'InfoLastName',
          middleName: 'InfoMiddleName',
          idDocs: [
            {
              ...mockApplicant.info.idDocs[0],
              firstName: 'DocFirstName',
              lastName: undefined,
              middleName: undefined,
            },
          ],
        },
      };

      const mockResponseWithPartialDocNames: AxiosResponse = {
        ...mockResponse,
        data: mockApplicantWithPartialDocNames,
      };

      (adapter.get as jest.Mock).mockResolvedValue(mockResponseWithPartialDocNames);

      const result = await adapter.getKycDetails(mockPayload);

      expect(result.data.firstName).toBe('DocFirstName');
      expect(result.data.lastName).toBe('InfoLastName');
      expect(result.data.middleName).toBe('InfoMiddleName');
    });

    it('should handle missing ID documents gracefully', async () => {
      const mockApplicantWithoutIdDocs = {
        ...mockApplicant,
        info: {
          ...mockApplicant.info,
          firstName: 'InfoFirstName',
          lastName: 'InfoLastName',
          middleName: 'InfoMiddleName',
          idDocs: undefined,
        },
      };

      const mockResponseWithoutIdDocs: AxiosResponse = {
        ...mockResponse,
        data: mockApplicantWithoutIdDocs,
      };

      (adapter.get as jest.Mock).mockResolvedValue(mockResponseWithoutIdDocs);

      const result = await adapter.getKycDetails(mockPayload);

      expect(result.data.firstName).toBe('InfoFirstName');
      expect(result.data.lastName).toBe('InfoLastName');
      expect(result.data.middleName).toBe('InfoMiddleName');
      expect(result.data.idDocument).toBeUndefined();
    });

    it('should transform Nigerian ID_CARD to NIN in additionalIdDocuments', async () => {
      const mockApplicantWithNIN = {
        ...mockApplicant,
        info: {
          ...mockApplicant.info,
          country: 'NGA',
          idDocs: [
            {
              idDocType: 'PASSPORT',
              country: 'NGA',
              firstName: 'John',
              lastName: 'Doe',
              middleName: '',
              validUntil: '2030-01-01',
              number: 'A12345678',
              dob: '1990-01-01',
            },
            {
              idDocType: 'ID_CARD',
              country: 'NGA',
              firstName: 'John',
              lastName: 'Doe',
              middleName: '',
              validUntil: '2035-01-01',
              number: '12345678901',
              dob: '1990-01-01',
            },
          ],
        },
      };

      const mockResponseWithNIN: AxiosResponse = {
        ...mockResponse,
        data: mockApplicantWithNIN,
      };

      (adapter.get as jest.Mock).mockResolvedValue(mockResponseWithNIN);

      const result = await adapter.getKycDetails(mockPayload);

      expect(result.data.additionalIdDocuments).toHaveLength(2);
      expect(result.data.additionalIdDocuments[0]).toEqual({
        country_code: 'NGA',
        type: 'PASSPORT',
        number: 'A12345678',
        validUntil: '2030-01-01',
      });
      expect(result.data.additionalIdDocuments[1]).toEqual({
        country_code: 'NGA',
        type: 'NIN',
        number: '12345678901',
        validUntil: '2035-01-01',
      });
    });

    it('should not transform ID_CARD to NIN for non-Nigerian users', async () => {
      const mockApplicantWithIDCard = {
        ...mockApplicant,
        info: {
          ...mockApplicant.info,
          country: 'USA',
          idDocs: [
            {
              idDocType: 'PASSPORT',
              country: 'USA',
              firstName: 'John',
              lastName: 'Doe',
              middleName: '',
              validUntil: '2030-01-01',
              number: 'A12345678',
              dob: '1990-01-01',
            },
            {
              idDocType: 'ID_CARD',
              country: 'USA',
              firstName: 'John',
              lastName: 'Doe',
              middleName: '',
              validUntil: '2035-01-01',
              number: '123456789',
              dob: '1990-01-01',
            },
          ],
        },
      };

      const mockResponseWithIDCard: AxiosResponse = {
        ...mockResponse,
        data: mockApplicantWithIDCard,
      };

      (adapter.get as jest.Mock).mockResolvedValue(mockResponseWithIDCard);

      const result = await adapter.getKycDetails(mockPayload);

      expect(result.data.additionalIdDocuments).toHaveLength(2);
      expect(result.data.additionalIdDocuments[1]).toEqual({
        country_code: 'USA',
        type: 'ID_CARD',
        number: '123456789',
        validUntil: '2035-01-01',
      });
    });

    it('should handle multiple ID documents correctly', async () => {
      const mockApplicantWithMultipleIds = {
        ...mockApplicant,
        info: {
          ...mockApplicant.info,
          country: 'NGA',
          idDocs: [
            {
              idDocType: 'PASSPORT',
              country: 'NGA',
              firstName: 'John',
              lastName: 'Doe',
              middleName: '',
              validUntil: '2030-01-01',
              number: 'A12345678',
              dob: '1990-01-01',
            },
            {
              idDocType: 'DRIVERS',
              country: 'NGA',
              firstName: 'John',
              lastName: 'Doe',
              middleName: '',
              validUntil: '2028-01-01',
              number: 'DL987654',
              dob: '1990-01-01',
            },
            {
              idDocType: 'ID_CARD',
              country: 'NGA',
              firstName: 'John',
              lastName: 'Doe',
              middleName: '',
              validUntil: '2035-01-01',
              number: '12345678901',
              dob: '1990-01-01',
            },
          ],
        },
      };

      const mockResponseWithMultipleIds: AxiosResponse = {
        ...mockResponse,
        data: mockApplicantWithMultipleIds,
      };

      (adapter.get as jest.Mock).mockResolvedValue(mockResponseWithMultipleIds);

      const result = await adapter.getKycDetails(mockPayload);

      expect(result.data.additionalIdDocuments).toHaveLength(3);
      expect(result.data.additionalIdDocuments[0].type).toBe('PASSPORT');
      expect(result.data.additionalIdDocuments[1].type).toBe('DRIVERS');
      expect(result.data.additionalIdDocuments[2].type).toBe('NIN');
    });

    it('should handle empty idDocs array in additionalIdDocuments', async () => {
      const mockApplicantWithEmptyIdDocs = {
        ...mockApplicant,
        info: {
          ...mockApplicant.info,
          idDocs: [],
        },
      };

      const mockResponseWithEmptyIdDocs: AxiosResponse = {
        ...mockResponse,
        data: mockApplicantWithEmptyIdDocs,
      };

      (adapter.get as jest.Mock).mockResolvedValue(mockResponseWithEmptyIdDocs);

      const result = await adapter.getKycDetails(mockPayload);

      expect(result.data.additionalIdDocuments).toEqual([]);
    });

    it('should handle case insensitive country check for NIN transformation', async () => {
      const mockApplicantWithLowercaseCountry = {
        ...mockApplicant,
        info: {
          ...mockApplicant.info,
          country: 'nga',
          idDocs: [
            {
              idDocType: 'ID_CARD',
              country: 'NGA',
              firstName: 'John',
              lastName: 'Doe',
              middleName: '',
              validUntil: '2035-01-01',
              number: '12345678901',
              dob: '1990-01-01',
            },
          ],
        },
      };

      const mockResponseWithLowercaseCountry: AxiosResponse = {
        ...mockResponse,
        data: mockApplicantWithLowercaseCountry,
      };

      (adapter.get as jest.Mock).mockResolvedValue(mockResponseWithLowercaseCountry);

      const result = await adapter.getKycDetails(mockPayload);

      expect(result.data.additionalIdDocuments).toHaveLength(1);
      expect(result.data.additionalIdDocuments[0].type).toBe('NIN');
    });

    it('should preserve original document type for non-ID_CARD documents', async () => {
      const mockApplicantWithVariousDocTypes = {
        ...mockApplicant,
        info: {
          ...mockApplicant.info,
          country: 'NGA',
          idDocs: [
            {
              idDocType: 'PASSPORT',
              country: 'NGA',
              firstName: 'John',
              lastName: 'Doe',
              validUntil: '2030-01-01',
              number: 'A12345678',
              dob: '1990-01-01',
            },
            {
              idDocType: 'RESIDENCE_PERMIT',
              country: 'NGA',
              firstName: 'John',
              lastName: 'Doe',
              validUntil: '2029-01-01',
              number: 'RP123456',
              dob: '1990-01-01',
            },
          ],
        },
      };

      const mockResponseWithVariousDocTypes: AxiosResponse = {
        ...mockResponse,
        data: mockApplicantWithVariousDocTypes,
      };

      (adapter.get as jest.Mock).mockResolvedValue(mockResponseWithVariousDocTypes);

      const result = await adapter.getKycDetails(mockPayload);

      expect(result.data.additionalIdDocuments).toHaveLength(2);
      expect(result.data.additionalIdDocuments[0].type).toBe('PASSPORT');
      expect(result.data.additionalIdDocuments[1].type).toBe('RESIDENCE_PERMIT');
    });

    it('should extract address from metadata when present', async () => {
      const mockApplicantWithMetadata = {
        ...mockApplicant,
        metadata: [
          { key: 'Street', value: '123 Metadata Street' },
          { key: 'City', value: 'Metadata City' },
          { key: 'State', value: 'Metadata State' },
          { key: 'Postcode', value: '12345' },
        ],
      };

      const mockResponseWithMetadata: AxiosResponse = {
        ...mockResponse,
        data: mockApplicantWithMetadata,
      };

      (adapter.get as jest.Mock).mockResolvedValue(mockResponseWithMetadata);

      const result = await adapter.getKycDetails(mockPayload);

      // Country comes from fixedInfo.addresses[0].country, not from metadata
      expect(result.data.address).toEqual({
        address: '123 Metadata Street, Metadata City, Metadata State, Nigeria',
        city: 'Metadata City',
        country: 'Nigeria',
        postalCode: '12345',
        state: 'Metadata State',
      });
    });

    it('should prioritize metadata address over fixedInfo address', async () => {
      const mockApplicantWithBothAddresses = {
        ...mockApplicant,
        fixedInfo: {
          ...mockApplicant.fixedInfo,
          addresses: [
            {
              subStreet: 'FixedInfo Apt',
              street: 'FixedInfo Street',
              state: 'FixedInfo State',
              town: 'FixedInfo City',
              postCode: '99999',
              country: 'FixedInfo Country',
            },
          ],
        },
        metadata: [
          { key: 'Street', value: 'Metadata Street' },
          { key: 'City', value: 'Metadata City' },
          { key: 'State', value: 'Metadata State' },
          { key: 'Postcode', value: '11111' },
        ],
      };

      const mockResponseWithBothAddresses: AxiosResponse = {
        ...mockResponse,
        data: mockApplicantWithBothAddresses,
      };

      (adapter.get as jest.Mock).mockResolvedValue(mockResponseWithBothAddresses);

      const result = await adapter.getKycDetails(mockPayload);

      // Metadata fields are used, but country comes from fixedInfo.addresses[0].country
      expect(result.data.address).toEqual({
        address: 'Metadata Street, Metadata City, Metadata State, FixedInfo Country',
        city: 'Metadata City',
        country: 'FixedInfo Country',
        postalCode: '11111',
        state: 'Metadata State',
      });
    });

    it('should handle partial metadata address fields', async () => {
      const mockApplicantWithPartialMetadata = {
        ...mockApplicant,
        metadata: [
          { key: 'Street', value: '456 Partial Street' },
          { key: 'City', value: 'Partial City' },
        ],
      };

      const mockResponseWithPartialMetadata: AxiosResponse = {
        ...mockResponse,
        data: mockApplicantWithPartialMetadata,
      };

      (adapter.get as jest.Mock).mockResolvedValue(mockResponseWithPartialMetadata);

      const result = await adapter.getKycDetails(mockPayload);

      // Country comes from fixedInfo.addresses[0].country (Nigeria)
      expect(result.data.address).toEqual({
        address: '456 Partial Street, Partial City, undefined, Nigeria',
        city: 'Partial City',
        country: 'Nigeria',
        postalCode: undefined,
        state: undefined,
      });
    });

    it('should handle empty metadata array', async () => {
      const mockApplicantWithEmptyMetadata = {
        ...mockApplicant,
        metadata: [],
      };

      const mockResponseWithEmptyMetadata: AxiosResponse = {
        ...mockResponse,
        data: mockApplicantWithEmptyMetadata,
      };

      (adapter.get as jest.Mock).mockResolvedValue(mockResponseWithEmptyMetadata);

      const result = await adapter.getKycDetails(mockPayload);

      // Country comes from fixedInfo.addresses[0].country (Nigeria)
      expect(result.data.address).toEqual({
        address: 'undefined, undefined, undefined, Nigeria',
        city: undefined,
        country: 'Nigeria',
        postalCode: undefined,
        state: undefined,
      });
    });

    it('should use fixedInfo address when metadata is not present', async () => {
      const mockApplicantWithoutMetadata = {
        ...mockApplicant,
        metadata: undefined,
      };

      const mockResponseWithoutMetadata: AxiosResponse = {
        ...mockResponse,
        data: mockApplicantWithoutMetadata,
      };

      (adapter.get as jest.Mock).mockResolvedValue(mockResponseWithoutMetadata);

      const result = await adapter.getKycDetails(mockPayload);

      expect(result.data.address).toEqual({
        address: 'Main Street',
        address2: 'Apt 123',
        city: 'Lagos',
        country: 'Nigeria',
        postalCode: '100001',
        state: 'Lagos',
      });
    });
  });

  describe('processWebhook', () => {
    const mockWebhookPayload: ProcessKycWebhookPayload = {
      applicantId: 'APP123',
      type: 'applicantReviewed',
      kycStatus: KycVerificationEnum.APPROVED,
    };

    const mockKycDetailsResponse = {
      data: {
        id: 'APP123',
        userId: 'USER123',
        inspectionId: 'INSP123',
        firstName: 'John',
        lastName: 'Doe',
        middleName: '',
        dob: '1990-01-01',
        country: 'Nigeria',
        email: 'john.doe@example.com',
        phone: '+1234567890',
        status: KycVerificationEnum.APPROVED,
        errorMessage: null,
        failureReason: null,
        failureCorrection: 'Approved',
      },
      message: 'SUCCESS',
      status: 200,
    };

    it('should successfully process webhook', async () => {
      jest.spyOn(adapter, 'getKycDetails').mockResolvedValue(mockKycDetailsResponse);

      const result = await adapter.processWebhook(mockWebhookPayload);

      expect(result).toEqual({
        data: {
          type: 'applicantReviewed',
          kycStatus: KycVerificationEnum.APPROVED,
          kycDetails: mockKycDetailsResponse.data,
          rejectReason: null,
        },
        message: 'SUCCESS',
        status: 200,
      });
      expect(adapter.getKycDetails).toHaveBeenCalledWith(mockWebhookPayload);
    });

    it('should handle error when processing webhook', async () => {
      const error = new Error('Failed to process webhook');
      jest.spyOn(adapter, 'getKycDetails').mockRejectedValue(error);

      await expect(adapter.processWebhook(mockWebhookPayload)).rejects.toThrow(error);
    });
  });

  describe('verifySignature', () => {
    it('should throw NotImplementedException', () => {
      expect(() => adapter.verifySignature()).toThrow(NotImplementedException);
    });
  });

  describe('generateAccessToken', () => {
    const mockPayload: GenerateAccessTokenPayload & { levelName: string } = {
      userId: 'USER123',
      verificationType: 'id-and-liveness',
      applicantIdentifier: {
        email: 'john.doe@example.com',
        phone: '+1234567890',
      },
      levelName: 'id-and-liveness',
    };

    const mockResponse: AxiosResponse = {
      data: {
        token: 'mock-token',
        userId: 'USER123',
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    };

    it('should successfully generate access token', async () => {
      (adapter.post as jest.Mock).mockResolvedValue(mockResponse);

      const result = await adapter.generateAccessToken(mockPayload);

      expect(result).toEqual({
        data: {
          kycVerificationType: 'id-and-liveness',
          token: 'mock-token',
          userId: 'USER123',
        },
        message: 'SUCCESS',
        status: 200,
      });
      expect(adapter.post).toHaveBeenCalledWith('/resources/accessTokens/sdk', {
        ...mockPayload,
        levelName: mockPayload.verificationType,
      });
    });

    it('should handle error when generating access token', async () => {
      const error = new Error('Failed to generate access token');
      (adapter.post as jest.Mock).mockRejectedValue(error);

      await expect(adapter.generateAccessToken(mockPayload)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('getKycDetailsByUserId', () => {
    const userId = 'USER123';
    const mockApplicant = {
      id: 'APP123',
      createdAt: '2024-03-20T10:00:00Z',
      inspectionId: 'INSP123',
      externalUserId: 'USER123',
      email: 'john.doe@example.com',
      phone: '+1234567890',
      applicantPlatform: 'web',
      agreement: {
        items: [
          {
            id: 'AGR123',
            acceptedAt: '2024-03-20T10:05:00Z',
            source: 'web',
            type: 'default',
            recordIds: [],
          },
        ],
        createdAt: '2024-03-20T10:00:00Z',
        source: 'web',
        recordIds: [],
      },
      fixedInfo: {
        dob: '1990-01-01',
        country: 'Nigeria',
        residenceCountry: 'Nigeria',
        tin: 'A12345678',
        addresses: [
          {
            subStreet: 'Apt 123',
            subStreetEn: 'Apt 123',
            street: 'Main Street',
            streetEn: 'Main Street',
            state: 'Lagos',
            stateEn: 'Lagos',
            stateCode: 'LA',
            town: 'Lagos',
            townEn: 'Lagos',
            postCode: '100001',
            country: 'Nigeria',
            formattedAddress: 'Apt 123, Main Street, Lagos, Nigeria',
          },
        ],
      },
      info: {
        firstName: 'John',
        firstNameEn: 'John',
        middleName: '',
        middleNameEn: '',
        lastName: 'Doe',
        lastNameEn: 'Doe',
        dob: '1990-01-01',
        country: 'Nigeria',
        idDocs: [
          {
            idDocType: 'PASSPORT',
            country: 'Nigeria',
            firstName: 'John',
            firstNameEn: 'John',
            middleName: '',
            middleNameEn: '',
            lastName: 'Doe',
            lastNameEn: 'Doe',
            validUntil: '2030-01-01',
            number: 'A12345678',
            dob: '1990-01-01',
          },
        ],
        addresses: [
          {
            subStreet: 'Apt 123',
            subStreetEn: 'Apt 123',
            street: 'Main Street',
            streetEn: 'Main Street',
            state: 'Lagos',
            stateEn: 'Lagos',
            stateCode: 'LA',
            town: 'Lagos',
            townEn: 'Lagos',
            postCode: '100001',
            country: 'Nigeria',
            formattedAddress: 'Apt 123, Main Street, Lagos, Nigeria',
          },
        ],
      },
      review: {
        reviewId: 'REV123',
        attemptId: 'ATT123',
        attemptCnt: 1,
        elapsedSincePendingMs: 300000,
        elapsedSinceQueuedMs: 60000,
        reprocessing: false,
        levelName: 'basic-kyc-level',
        levelAutoCheckMode: 'AUTO',
        createDate: '2024-03-20T10:00:00Z',
        reviewDate: '2024-03-20T10:30:00Z',
        reviewResult: {
          reviewAnswer: 'GREEN',
          moderationComment: 'Approved',
          clientComment: null,
        },
        reviewStatus: 'completed',
        priority: 1,
      },
      lang: 'en',
      type: 'INDIVIDUAL',
    };

    const mockResponse: AxiosResponse = {
      data: mockApplicant,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    };

    it('should successfully get KYC details by user ID', async () => {
      (adapter.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await adapter.getKycDetailsByUserId(userId);

      expect(result).toEqual({
        data: {
          id: 'APP123',
          userId: 'USER123',
          referenceId: 'INSP123',
          firstName: 'John',
          lastName: 'Doe',
          middleName: '',
          dob: '1990-01-01',
          country: 'Nigeria',
          email: 'john.doe@example.com',
          phone: '+1234567890',
          address: {
            address: 'Main Street',
            address2: 'Apt 123',
            city: 'Lagos',
            country: 'Nigeria',
            postalCode: '100001',
            state: 'Lagos',
          },
          idNumber: 'A12345678',
          idDocument: {
            type: 'passport',
            number: 'A12345678',
            validUntil: '2030-01-01',
          },
          status: KycVerificationEnum.APPROVED,
          errorMessage: 'Approved',
          failureReason: undefined,
          failureCorrection: undefined,
          agreementAcceptedAt: '2024-03-20T10:05:00Z',
          platform: 'web',
          submittedAt: '2024-03-20T10:00:00Z',
          reviewedAt: '2024-03-20T10:30:00Z',
          completedAt: '2024-03-20T10:00:00Z',
          approvedAt: '2024-03-20T10:05:00Z',
          accountPurpose: undefined,
          mostRecentOccupation: undefined,
          employmentStatus: undefined,
          sourceOfFunds: undefined,
          expectedMonthlyPaymentsUsd: undefined,
          additionalIdDocuments: [
            {
              country_code: 'Nigeria',
              type: 'PASSPORT',
              number: 'A12345678',
              validUntil: '2030-01-01',
            },
          ],
        },
        message: 'SUCCESS',
        status: 200,
      });
      expect(adapter.get).toHaveBeenCalledWith(`/resources/applicants/-;externalUserId=${userId}/one`);
    });

    it('should handle error when getting KYC details by user ID', async () => {
      const error = new Error('Failed to get KYC details');
      (adapter.get as jest.Mock).mockRejectedValue(error);

      await expect(adapter.getKycDetailsByUserId(userId)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('performAMLCheck', () => {
    const mockPayload = {
      applicantId: 'APP123',
    };

    const mockResponse: AxiosResponse = {
      data: {
        ok: 1,
        id: 'AML123',
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    };

    it('should successfully perform AML check', async () => {
      (adapter.post as jest.Mock).mockResolvedValue(mockResponse);

      const result = await adapter.performAMLCheck(mockPayload);

      expect(result).toEqual({
        data: mockResponse.data,
        message: 'SUCCESS',
        status: 200,
      });
      expect(adapter.post).toHaveBeenCalledWith(
        `/resources/applicants/${mockPayload.applicantId}/recheck/aml`,
        mockPayload,
      );
    });

    it('should handle failed AML check', async () => {
      const failedResponse: AxiosResponse = {
        data: {
          ok: 0,
          id: 'AML123',
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      (adapter.post as jest.Mock).mockResolvedValue(failedResponse);

      const result = await adapter.performAMLCheck(mockPayload);

      expect(result).toEqual({
        data: failedResponse.data,
        message: 'FAILED',
        status: 400,
      });
    });

    it('should handle error when performing AML check', async () => {
      const error = new Error('Failed to perform AML check');
      (adapter.post as jest.Mock).mockRejectedValue(error);

      await expect(adapter.performAMLCheck(mockPayload)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('initiateWidgetKyc', () => {
    it('should call generateAccessToken and return widget KYC response', async () => {
      const mockPayload = {
        email: 'test@example.com',
        phoneNumber: '+1234567890',
        kycVerificationType: 'BASIC',
        userId: 'user-123',
      };
      const mockAccessTokenResponse = {
        data: {
          token: 'mock-token',
          userId: 'user-123',
          kycVerificationType: 'BASIC',
        },
        message: 'SUCCESS',
        status: 200,
      };
      jest.spyOn(adapter, 'generateAccessToken').mockResolvedValue(mockAccessTokenResponse);

      const result = await adapter.initiateWidgetKyc(mockPayload as any);

      expect(adapter.generateAccessToken).toHaveBeenCalledWith({
        applicantIdentifier: {
          email: mockPayload.email,
          phone: mockPayload.phoneNumber,
        },
        verificationType: mockPayload.kycVerificationType,
        userId: mockPayload.userId,
      });
      expect(result).toEqual({
        token: 'mock-token',
        userId: 'user-123',
        kycVerificationType: 'BASIC',
      });
    });

    it('should throw error if generateAccessToken fails', async () => {
      const mockPayload = {
        email: 'test@example.com',
        phoneNumber: '+1234567890',
        kycVerificationType: 'BASIC',
        userId: 'user-123',
      };
      const error = new Error('Failed to generate access token');
      jest.spyOn(adapter, 'generateAccessToken').mockRejectedValue(error);

      await expect(adapter.initiateWidgetKyc(mockPayload as any)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('initiateDirectKyc', () => {
    it('should throw NotImplementedException', async () => {
      await expect(adapter.initiateDirectKyc()).rejects.toThrow('Not implemented');
    });
  });

  describe('validateKyc', () => {
    it('should throw NotImplementedException', async () => {
      await expect(adapter.validateKyc()).rejects.toThrow('Not implemented');
    });
  });

  describe('generateShareToken', () => {
    const mockPayload = {
      applicantId: 'APP123',
      forClientId: 'CLIENT123',
      ttlInSecs: 3600,
    };

    const mockResponse: AxiosResponse = {
      data: {
        token: 'share-token-123',
        forClientId: 'CLIENT123',
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    };

    it('should successfully generate share token', async () => {
      (adapter.post as jest.Mock).mockResolvedValue(mockResponse);

      const result = await adapter.generateShareToken(mockPayload);

      expect(result).toEqual({
        data: mockResponse.data,
        message: 'SUCCESS',
        status: 200,
      });
      expect(adapter.post).toHaveBeenCalledWith('/resources/accessTokens/shareToken', mockPayload);
    });

    it('should handle error when generating share token', async () => {
      const error = new Error('Failed to generate share token');
      (adapter.post as jest.Mock).mockRejectedValue(error);

      await expect(adapter.generateShareToken(mockPayload)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('getDocumentInfo', () => {
    const mockPayload = {
      applicantId: 'APP123',
    };

    const mockDocumentMetadataResponse: AxiosResponse = {
      data: {
        items: [
          {
            id: 'DOC123',
            previewId: 'PREV123',
            addedDate: '2024-03-20T10:00:00Z',
            fileMetadata: {
              fileName: 'passport.jpg',
              fileType: 'image/jpeg',
              fileSize: 102400,
              resolutionWidth: 1920,
              resolutionHeight: 1080,
            },
            idDocDef: {
              country: 'NG',
              idDocType: 'PASSPORT',
            },
            reviewResult: {
              reviewAnswer: 'GREEN',
            },
            deactivated: false,
            attemptId: 'ATT123',
            source: 'fileupload',
          },
          {
            id: 'DOC124',
            previewId: 'PREV124',
            addedDate: '2024-03-20T10:05:00Z',
            fileMetadata: {
              fileName: 'drivers_front.jpg',
              fileType: 'image/jpeg',
              fileSize: 102400,
              resolutionWidth: 1920,
              resolutionHeight: 1080,
            },
            idDocDef: {
              country: 'NG',
              idDocType: 'DRIVERS',
              idDocSubType: 'FRONT_SIDE',
            },
            reviewResult: {
              reviewAnswer: 'GREEN',
            },
            deactivated: false,
            attemptId: 'ATT123',
            source: 'fileupload',
          },
        ],
        totalItems: 2,
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    };

    it('should successfully get document info', async () => {
      (adapter.get as jest.Mock).mockResolvedValue(mockDocumentMetadataResponse);

      const result = await adapter.getDocumentInfo(mockPayload);

      expect(result.data.applicantId).toBe('APP123');
      expect(result.data.documents).toHaveLength(2);
      expect(result.data.documents[0]).toMatchObject({
        id: 'DOC123',
        documentType: 'PASSPORT',
        country: 'NG',
        uploadSource: 'fileupload',
        verificationResult: 'GREEN',
        originalFileName: 'passport.jpg',
        mimeType: 'image/jpeg',
      });
      expect(result.data.documents[1]).toMatchObject({
        id: 'DOC124',
        documentType: 'DRIVERS',
        documentSubType: 'FRONT_SIDE',
        country: 'NG',
        uploadSource: 'fileupload',
        verificationResult: 'GREEN',
        originalFileName: 'drivers_front.jpg',
        mimeType: 'image/jpeg',
      });
      expect(result.message).toBe('SUCCESS');
      expect(result.status).toBe(200);
      expect(adapter.get).toHaveBeenCalledWith(`/resources/applicants/${mockPayload.applicantId}/metadata/resources`);
    });

    it('should filter out unsupported document types', async () => {
      const mockResponseWithUnsupported: AxiosResponse = {
        ...mockDocumentMetadataResponse,
        data: {
          ...mockDocumentMetadataResponse.data,
          items: [
            ...mockDocumentMetadataResponse.data.items,
            {
              id: 'DOC125',
              previewId: 'PREV125',
              addedDate: '2024-03-20T10:10:00Z',
              fileMetadata: {
                fileName: 'unsupported.jpg',
                fileType: 'image/jpeg',
                fileSize: 102400,
                resolutionWidth: 1920,
                resolutionHeight: 1080,
              },
              idDocDef: {
                country: 'NG',
                idDocType: 'UNSUPPORTED_TYPE',
              },
              reviewResult: {
                reviewAnswer: 'GREEN',
              },
              deactivated: false,
              attemptId: 'ATT123',
              source: 'fileupload',
            },
          ],
        },
      };

      (adapter.get as jest.Mock).mockResolvedValue(mockResponseWithUnsupported);

      const result = await adapter.getDocumentInfo(mockPayload);

      expect(result.data.documents).toHaveLength(2);
      expect(result.data.documents.find((doc) => doc.id === 'DOC125')).toBeUndefined();
    });

    it('should handle empty document list', async () => {
      const mockEmptyResponse: AxiosResponse = {
        data: {
          items: [],
          totalItems: 0,
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      (adapter.get as jest.Mock).mockResolvedValue(mockEmptyResponse);

      const result = await adapter.getDocumentInfo(mockPayload);

      expect(result.data.applicantId).toBe('APP123');
      expect(result.data.documents).toHaveLength(0);
      expect(result.message).toBe('SUCCESS');
      expect(result.status).toBe(200);
    });

    it('should handle error when getting document info', async () => {
      const error = new Error('Failed to get document info');
      (adapter.get as jest.Mock).mockRejectedValue(error);

      await expect(adapter.getDocumentInfo(mockPayload)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('getDocumentContent', () => {
    const mockPayload = {
      referenceId: 'INSP123',
      documentId: 'DOC123',
    };

    const mockBuffer = Buffer.from('mock document content');
    const mockResponse: AxiosResponse = {
      data: mockBuffer,
      status: 200,
      statusText: 'OK',
      headers: {
        'content-type': 'image/jpeg',
        'content-length': '20',
      },
      config: {} as any,
    };

    it('should successfully get document content as JPEG', async () => {
      (adapter.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await adapter.getDocumentContent(mockPayload);

      expect(result.data.documentId).toBe('DOC123');
      expect(result.data.content).toBe(mockBuffer.toString('base64'));
      expect(result.data.mimeType).toBe('image/jpeg');
      expect(result.data.fileName).toBe('document_DOC123.jpg');
      expect(result.message).toBe('SUCCESS');
      expect(result.status).toBe(200);
      expect(adapter.get).toHaveBeenCalledWith(
        `/resources/inspections/${mockPayload.referenceId}/resources/${mockPayload.documentId}`,
      );
    });

    it('should handle PNG content type', async () => {
      const mockPngResponse: AxiosResponse = {
        ...mockResponse,
        headers: {
          'content-type': 'image/png',
          'content-length': '20',
        },
      };

      (adapter.get as jest.Mock).mockResolvedValue(mockPngResponse);

      const result = await adapter.getDocumentContent(mockPayload);

      expect(result.data.mimeType).toBe('image/png');
      expect(result.data.fileName).toBe('document_DOC123.png');
    });

    it('should handle PDF content type', async () => {
      const mockPdfResponse: AxiosResponse = {
        ...mockResponse,
        headers: {
          'content-type': 'application/pdf',
          'content-length': '20',
        },
      };

      (adapter.get as jest.Mock).mockResolvedValue(mockPdfResponse);

      const result = await adapter.getDocumentContent(mockPayload);

      expect(result.data.mimeType).toBe('application/pdf');
      expect(result.data.fileName).toBe('document_DOC123.pdf');
    });

    it('should handle missing content type', async () => {
      const mockNoContentTypeResponse: AxiosResponse = {
        ...mockResponse,
        headers: {
          'content-length': '20',
        },
      };

      (adapter.get as jest.Mock).mockResolvedValue(mockNoContentTypeResponse);

      const result = await adapter.getDocumentContent(mockPayload);

      expect(result.data.mimeType).toBe('application/octet-stream');
      expect(result.data.fileName).toBe('document_DOC123.bin');
    });

    it('should handle error when getting document content', async () => {
      const error = new Error('Failed to get document content');
      (adapter.get as jest.Mock).mockRejectedValue(error);

      await expect(adapter.getDocumentContent(mockPayload)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('supportedCountries', () => {
    it('should return supported countries', () => {
      const countries = adapter.supportedCountries();
      expect(countries).toEqual(['US', 'NG']);
    });
  });

  describe('resetApplicant', () => {
    const mockPayload = {
      applicantId: 'APP123',
    };

    it('should reset applicant successfully', async () => {
      jest.spyOn(adapter, 'post').mockResolvedValue({} as AxiosResponse);

      const result = await adapter.resetApplicant(mockPayload);

      expect(adapter.post).toHaveBeenCalledWith('/resources/applicants/APP123/reset', {});
      expect(result).toEqual({
        data: { ok: 1 },
        message: 'SUCCESS',
        status: 200,
      });
    });

    it('should throw InternalServerErrorException when reset fails', async () => {
      const error = new Error('Reset failed');
      jest.spyOn(adapter, 'post').mockRejectedValue(error);

      await expect(adapter.resetApplicant(mockPayload)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('updateApplicantTaxInfo', () => {
    const mockPayload = {
      applicantId: 'APP123',
      tin: '123-45-6789',
    };

    it('should update applicant tax info successfully', async () => {
      jest.spyOn(adapter, 'patch').mockResolvedValue({} as AxiosResponse);

      const result = await adapter.updateApplicantTaxInfo(mockPayload);

      expect(adapter.patch).toHaveBeenCalledWith('/resources/applicants/APP123/fixedInfo', {
        tin: '123-45-6789',
      });
      expect(result).toEqual({
        data: { ok: 1 },
        message: 'SUCCESS',
        status: 200,
      });
    });

    it('should update applicant tax info with empty tin', async () => {
      const payloadWithEmptyTin = {
        applicantId: 'APP123',
        tin: '',
      };
      jest.spyOn(adapter, 'patch').mockResolvedValue({} as AxiosResponse);

      const result = await adapter.updateApplicantTaxInfo(payloadWithEmptyTin);

      expect(adapter.patch).toHaveBeenCalledWith('/resources/applicants/APP123/fixedInfo', {
        tin: '',
      });
      expect(result).toEqual({
        data: { ok: 1 },
        message: 'SUCCESS',
        status: 200,
      });
    });

    it('should update applicant tax info when tin is undefined', async () => {
      const payloadWithoutTin = {
        applicantId: 'APP123',
      };
      jest.spyOn(adapter, 'patch').mockResolvedValue({} as AxiosResponse);

      const result = await adapter.updateApplicantTaxInfo(payloadWithoutTin);

      expect(adapter.patch).toHaveBeenCalledWith('/resources/applicants/APP123/fixedInfo', {
        tin: '',
      });
      expect(result).toEqual({
        data: { ok: 1 },
        message: 'SUCCESS',
        status: 200,
      });
    });

    it('should throw InternalServerErrorException when update fails', async () => {
      const error = new Error('Update failed');
      jest.spyOn(adapter, 'patch').mockRejectedValue(error);

      await expect(adapter.updateApplicantTaxInfo(mockPayload)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('updateApplicantFixedInfo', () => {
    const applicantId = 'APP123';
    const mockPayload = {
      dob: '1990-01-01',
      country: 'Nigeria',
      tin: '123456789',
    };

    const mockResponse: AxiosResponse = {
      data: {
        dob: '1990-01-01',
        country: 'Nigeria',
        residenceCountry: 'Nigeria',
        tin: '123456789',
        addresses: [],
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    };

    it('should update applicant fixed info successfully', async () => {
      (adapter.patch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await adapter.updateApplicantFixedInfo(applicantId, mockPayload);

      expect(adapter.patch).toHaveBeenCalledWith(`/resources/applicants/${applicantId}/fixedInfo`, mockPayload);
      expect(result).toEqual(mockResponse.data);
    });

    it('should handle partial payload with tin only', async () => {
      const partialPayload = { tin: '987654321' };
      const partialResponse: AxiosResponse = {
        ...mockResponse,
        data: { ...mockResponse.data, tin: '987654321' },
      };
      (adapter.patch as jest.Mock).mockResolvedValue(partialResponse);

      const result = await adapter.updateApplicantFixedInfo(applicantId, partialPayload);

      expect(adapter.patch).toHaveBeenCalledWith(`/resources/applicants/${applicantId}/fixedInfo`, partialPayload);
      expect(result).toEqual(partialResponse.data);
    });

    it('should throw InternalServerErrorException when update fails', async () => {
      const error = new Error('Update failed');
      (adapter.patch as jest.Mock).mockRejectedValue(error);

      await expect(adapter.updateApplicantFixedInfo(applicantId, mockPayload)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('getKycDetailsByUserIdWithTransform', () => {
    const userId = 'USER123';
    const mockApplicant = {
      id: 'APP123',
      createdAt: '2024-03-20T10:00:00Z',
      inspectionId: 'INSP123',
      externalUserId: 'USER123',
      email: 'john.doe@example.com',
      phone: '+1234567890',
      applicantPlatform: 'web',
      fixedInfo: {
        dob: '1990-01-01',
        country: 'Nigeria',
        tin: 'A12345678',
      },
      info: {
        firstName: 'John',
        lastName: 'Doe',
        dob: '1990-01-01',
        country: 'Nigeria',
      },
      review: {
        reviewId: 'REV123',
        reviewStatus: 'completed',
        reviewResult: {
          reviewAnswer: 'GREEN',
        },
      },
      lang: 'en',
      type: 'INDIVIDUAL',
    };

    const mockResponse: AxiosResponse = {
      data: mockApplicant,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    };

    it('should return raw applicant data without transformation', async () => {
      (adapter.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await adapter.getKycDetailsByUserIdWithTransform(userId);

      expect(adapter.get).toHaveBeenCalledWith(`/resources/applicants/-;externalUserId=${userId}/one`);
      expect(result).toEqual(mockApplicant);
    });

    it('should throw InternalServerErrorException when request fails', async () => {
      const error = new Error('Failed to get applicant');
      (adapter.get as jest.Mock).mockRejectedValue(error);

      await expect(adapter.getKycDetailsByUserIdWithTransform(userId)).rejects.toThrow(InternalServerErrorException);
    });
  });
});
