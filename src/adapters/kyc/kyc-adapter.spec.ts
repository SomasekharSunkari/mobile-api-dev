import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AdapterConfigProvider } from '../../config/adapter.config';
import { KycVerificationEnum } from '../../database/models/kycVerification/kycVerification.interface';
import { KYCAdapter } from './kyc-adapter';
import {
  GenerateAccessTokenPayload,
  GenerateShareTokenPayload,
  GetDocumentContentPayload,
  GetDocumentInfoPayload,
  GetKycDetailsPayload,
  InitiateDirectKycPayload,
  InitiateWidgetKycPayload,
  PerformAMLCheckPayload,
  ProcessKycWebhookPayload,
} from './kyc-adapter.interface';
import { SumsubAdapter } from './sumsub/sumsub.adapter';

describe('KYCAdapter', () => {
  let adapter: KYCAdapter;

  const mockSumsubAdapter = {
    processWebhook: jest.fn(),
    initiateWidgetKyc: jest.fn(),
    initiateDirectKyc: jest.fn(),
    verifySignature: jest.fn(),
    getFullInfo: jest.fn(),
    getKycDetails: jest.fn(),
    generateAccessToken: jest.fn(),
    generateShareToken: jest.fn(),
    getKycDetailsByUserId: jest.fn(),
    performAMLCheck: jest.fn(),
    getDocumentInfo: jest.fn(),
    getDocumentContent: jest.fn(),
    validateKyc: jest.fn(),
    supportedCountries: jest.fn(),
    resetApplicant: jest.fn(),
    updateApplicantTaxInfo: jest.fn(),
  };

  const mockConfig = {
    kyc: {
      default_ng_kyc_provider: 'sumsub',
      default_us_kyc_provider: 'sumsub',
      default_kyc_provider: 'sumsub',
    },
    getConfig: () => ({
      kyc: {
        default_ng_kyc_provider: 'sumsub',
        default_us_kyc_provider: 'sumsub',
        default_kyc_provider: 'sumsub',
      },
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KYCAdapter,
        { provide: AdapterConfigProvider, useValue: mockConfig },
        { provide: SumsubAdapter, useValue: mockSumsubAdapter },
      ],
    }).compile();
    adapter = module.get<KYCAdapter>(KYCAdapter);
  });

  describe('getProviderName', () => {
    it('should return the correct provider for a country', () => {
      expect(adapter.getProviderName('NG')).toBe('sumsub');
      expect(adapter.getProviderName('US')).toBe('sumsub');
    });

    it('should return default provider when no country is provided', () => {
      expect(adapter.getProviderName('')).toBe('sumsub');
    });
  });

  describe('getProvider', () => {
    it('should return the correct adapter for a country', () => {
      expect((adapter as any).getProvider('ng')).toBe(mockSumsubAdapter);
      expect((adapter as any).getProvider('us')).toBe(mockSumsubAdapter);
    });

    it('should throw if no provider configured', () => {
      jest.spyOn(adapter, 'getProviderName').mockReturnValue(undefined as any);
      expect(() => (adapter as any).getProvider('xx')).toThrow(BadRequestException);
    });

    it('should throw if provider is unsupported', () => {
      jest.spyOn(adapter, 'getProviderName').mockReturnValue('unknown');
      expect(() => (adapter as any).getProvider('xx')).toThrow(BadRequestException);
    });
  });

  describe('processWebhook', () => {
    const mockWebhookPayload: ProcessKycWebhookPayload = {
      applicantId: 'APP123',
      type: 'applicantReviewed',
      kycStatus: KycVerificationEnum.APPROVED,
      country: 'US',
    };

    it('should call processWebhook on sumsub when provider is specified', async () => {
      mockSumsubAdapter.processWebhook.mockResolvedValue({ result: 'ok' });
      const result = await adapter.processWebhook(mockWebhookPayload, 'sumsub');
      expect(mockSumsubAdapter.processWebhook).toHaveBeenCalledWith(mockWebhookPayload as any);
      expect(result).toEqual({ result: 'ok' });
    });

    it('should use country to determine provider when no provider is specified', async () => {
      mockSumsubAdapter.processWebhook.mockResolvedValue({ result: 'ok' });
      const webhookPayloadWithNGCountry: ProcessKycWebhookPayload = {
        applicantId: 'APP123',
        type: 'applicantReviewed',
        kycStatus: KycVerificationEnum.APPROVED,
        country: 'NG',
      };
      const result = await adapter.processWebhook(webhookPayloadWithNGCountry);
      expect(mockSumsubAdapter.processWebhook).toHaveBeenCalledWith(webhookPayloadWithNGCountry as any);
      expect(result).toEqual({ result: 'ok' });
    });

    it('should throw for unsupported provider', async () => {
      await expect(adapter.processWebhook(mockWebhookPayload, 'unknown')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getKycDetails', () => {
    const mockPayload: GetKycDetailsPayload = {
      applicantId: 'APP123',
    };

    it('should call getKycDetails on the default provider', async () => {
      mockSumsubAdapter.getKycDetails.mockResolvedValue({ data: 'ok' });
      const result = await adapter.getKycDetails(mockPayload);
      expect(mockSumsubAdapter.getKycDetails).toHaveBeenCalledWith(mockPayload);
      expect(result).toEqual({ data: 'ok' });
    });
  });

  describe('initiateWidgetKyc', () => {
    const mockPayload: InitiateWidgetKycPayload = {
      userId: 'USER123',
      kycVerificationType: 'BASIC',
    };

    it('should call initiateWidgetKyc on the correct provider', async () => {
      mockSumsubAdapter.initiateWidgetKyc.mockResolvedValue({ widget: 'ok' });
      const result = await adapter.initiateWidgetKyc(mockPayload);
      expect(mockSumsubAdapter.initiateWidgetKyc).toHaveBeenCalledWith({
        userId: 'USER123',
        kycVerificationType: 'BASIC',
      });
      expect(result).toEqual({ widget: 'ok' });
    });

    it('should call initiateWidgetKyc on the correct provider with country', async () => {
      mockSumsubAdapter.initiateWidgetKyc.mockResolvedValue({ widget: 'ok' });
      const result = await adapter.initiateWidgetKyc(mockPayload, 'NG');
      expect(mockSumsubAdapter.initiateWidgetKyc).toHaveBeenCalledWith({
        userId: 'USER123',
        kycVerificationType: 'BASIC',
      });
      expect(result).toEqual({ widget: 'ok' });
    });
  });

  describe('initiateDirectKyc', () => {
    const mockPayload: InitiateDirectKycPayload & { country: string } = {
      userId: 'USER123',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      phoneNumber: '+1234567890',
      country: 'NG',
    };

    it('should call initiateDirectKyc on the correct provider', async () => {
      mockSumsubAdapter.initiateDirectKyc.mockResolvedValue({ direct: 'ok' });
      const result = await adapter.initiateDirectKyc(mockPayload);
      expect(mockSumsubAdapter.initiateDirectKyc).toHaveBeenCalledWith({
        userId: 'USER123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phoneNumber: '+1234567890',
      });
      expect(result).toEqual({ direct: 'ok' });
    });
  });

  describe('verifySignature', () => {
    it('should call verifySignature on the correct provider', () => {
      mockSumsubAdapter.verifySignature.mockReturnValue(true);
      const req = {} as any;
      const result = adapter.verifySignature(req, 'NG');
      expect(mockSumsubAdapter.verifySignature).toHaveBeenCalledWith(req, 'NG');
      expect(result).toBe(true);
    });

    it('should call verifySignature on the default provider when country is not provided', () => {
      mockSumsubAdapter.verifySignature.mockReturnValue(true);
      const req = {} as any;
      const result = adapter.verifySignature(req, '');
      expect(mockSumsubAdapter.verifySignature).toHaveBeenCalledWith(req, '');
      expect(result).toBe(true);
    });
  });

  describe('getFullInfo', () => {
    it('should call getFullInfo on the correct provider', async () => {
      mockSumsubAdapter.getFullInfo.mockResolvedValue({ info: 'ok' });
      const result = await adapter.getFullInfo('code', 'NG');
      expect(mockSumsubAdapter.getFullInfo).toHaveBeenCalledWith('code', 'NG');
      expect(result).toEqual({ info: 'ok' });
    });

    it('should call getFullInfo on the default provider when country is not provided', async () => {
      mockSumsubAdapter.getFullInfo.mockResolvedValue({ info: 'ok' });
      const result = await adapter.getFullInfo('code', '');
      expect(mockSumsubAdapter.getFullInfo).toHaveBeenCalledWith('code', '');
      expect(result).toEqual({ info: 'ok' });
    });
  });

  describe('generateAccessToken', () => {
    const mockPayload: GenerateAccessTokenPayload = {
      userId: 'USER123',
      verificationType: 'basic-kyc-level',
      applicantIdentifier: {
        email: 'john@example.com',
        phone: '+1234567890',
      },
    };

    it('should call generateAccessToken on the default provider', async () => {
      mockSumsubAdapter.generateAccessToken.mockResolvedValue({ data: 'ok' });
      const result = await adapter.generateAccessToken(mockPayload);
      expect(mockSumsubAdapter.generateAccessToken).toHaveBeenCalledWith(mockPayload);
      expect(result).toEqual({ data: 'ok' });
    });
  });

  describe('generateShareToken', () => {
    const mockPayload: GenerateShareTokenPayload = {
      applicantId: 'APP123',
      forClientId: 'CLIENT123',
      ttlInSecs: 3600,
    };

    it('should call generateShareToken on the default provider', async () => {
      mockSumsubAdapter.generateShareToken.mockResolvedValue({ data: 'ok' });
      const result = await adapter.generateShareToken(mockPayload);
      expect(mockSumsubAdapter.generateShareToken).toHaveBeenCalledWith(mockPayload);
      expect(result).toEqual({ data: 'ok' });
    });
  });

  describe('getKycDetailsByUserId', () => {
    it('should call getKycDetailsByUserId on the default provider', async () => {
      mockSumsubAdapter.getKycDetailsByUserId.mockResolvedValue({ data: 'ok' });
      const result = await adapter.getKycDetailsByUserId('USER123');
      expect(mockSumsubAdapter.getKycDetailsByUserId).toHaveBeenCalledWith('USER123');
      expect(result).toEqual({ data: 'ok' });
    });
  });

  describe('performAMLCheck', () => {
    const mockPayload: PerformAMLCheckPayload = {
      applicantId: 'APP123',
    };

    it('should call performAMLCheck on the default provider when supported', async () => {
      mockSumsubAdapter.performAMLCheck = jest.fn().mockResolvedValue({ data: 'ok' });
      const result = await adapter.performAMLCheck(mockPayload);
      expect(mockSumsubAdapter.performAMLCheck).toHaveBeenCalledWith(mockPayload);
      expect(result).toEqual({ data: 'ok' });
    });

    it('should throw when provider does not support AML check', async () => {
      mockSumsubAdapter.performAMLCheck = undefined;
      await expect(adapter.performAMLCheck(mockPayload)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getDocumentInfo', () => {
    const mockPayload: GetDocumentInfoPayload = {
      applicantId: 'APP123',
    };

    it('should call getDocumentInfo on the default provider', async () => {
      mockSumsubAdapter.getDocumentInfo.mockResolvedValue({ data: 'ok' });
      const result = await adapter.getDocumentInfo(mockPayload);
      expect(mockSumsubAdapter.getDocumentInfo).toHaveBeenCalledWith(mockPayload);
      expect(result).toEqual({ data: 'ok' });
    });
  });

  describe('getDocumentContent', () => {
    const mockPayload: GetDocumentContentPayload = {
      referenceId: 'REF123',
      documentId: 'DOC123',
    };

    it('should call getDocumentContent on the default provider', async () => {
      mockSumsubAdapter.getDocumentContent.mockResolvedValue({ data: 'ok' });
      const result = await adapter.getDocumentContent(mockPayload);
      expect(mockSumsubAdapter.getDocumentContent).toHaveBeenCalledWith(mockPayload);
      expect(result).toEqual({ data: 'ok' });
    });
  });

  describe('validateKyc', () => {
    it('should throw NotImplementedException', async () => {
      await expect(adapter.validateKyc()).rejects.toThrow('Not yet implemented');
    });
  });

  describe('supportedCountries', () => {
    it('should return ["US"]', () => {
      expect(adapter.supportedCountries()).toEqual(['US']);
    });
  });

  describe('resetApplicant', () => {
    const mockPayload = {
      applicantId: 'APP123',
    };

    it('should call resetApplicant on the default provider', async () => {
      mockSumsubAdapter.resetApplicant.mockResolvedValue({ data: { ok: 1 }, message: 'SUCCESS', status: 200 });
      const result = await adapter.resetApplicant(mockPayload);
      expect(mockSumsubAdapter.resetApplicant).toHaveBeenCalledWith(mockPayload);
      expect(result).toEqual({ data: { ok: 1 }, message: 'SUCCESS', status: 200 });
    });
  });

  describe('updateApplicantTaxInfo', () => {
    const mockPayload = {
      applicantId: 'APP123',
      tin: '123-45-6789',
    };

    it('should call updateApplicantTaxInfo on the default provider', async () => {
      mockSumsubAdapter.updateApplicantTaxInfo.mockResolvedValue({ data: { ok: 1 }, message: 'SUCCESS', status: 200 });
      const result = await adapter.updateApplicantTaxInfo(mockPayload);
      expect(mockSumsubAdapter.updateApplicantTaxInfo).toHaveBeenCalledWith(mockPayload);
      expect(result).toEqual({ data: { ok: 1 }, message: 'SUCCESS', status: 200 });
    });

    it('should call updateApplicantTaxInfo with empty tin', async () => {
      const payloadWithEmptyTin = {
        applicantId: 'APP123',
        tin: '',
      };
      mockSumsubAdapter.updateApplicantTaxInfo.mockResolvedValue({ data: { ok: 1 }, message: 'SUCCESS', status: 200 });
      const result = await adapter.updateApplicantTaxInfo(payloadWithEmptyTin);
      expect(mockSumsubAdapter.updateApplicantTaxInfo).toHaveBeenCalledWith(payloadWithEmptyTin);
      expect(result).toEqual({ data: { ok: 1 }, message: 'SUCCESS', status: 200 });
    });
  });
});
