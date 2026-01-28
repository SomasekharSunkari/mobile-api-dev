import { Test, TestingModule } from '@nestjs/testing';
import { ParticipantAdapter } from './participant.adapter';
import { ZerohashParticipantAdapter } from './zerohash/zerohash.adapter';
import { BadRequestException } from '@nestjs/common';
import {
  ParticipantCreateRequest,
  ParticipantCreateResponse,
  DepositAddressCreateRequest,
  DepositAddressCreateResponse,
} from './participant.adapter.interface';

describe('ParticipantAdapter', () => {
  let adapter: ParticipantAdapter;
  const mockZerohash = {
    createParticipant: jest.fn<Promise<ParticipantCreateResponse>, [ParticipantCreateRequest]>(),
    uploadKycDocument: jest.fn(),
    updateParticipant: jest.fn(),
    createDepositAddress: jest.fn<Promise<DepositAddressCreateResponse>, [DepositAddressCreateRequest]>(),
    getParticipantRef: jest.fn(),
    getKycStatus: jest.fn(),
  };
  const mockConfigProvider = {
    getConfig: jest.fn<{ default_participant_countries: string }, []>(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ParticipantAdapter,
        { provide: ZerohashParticipantAdapter, useValue: mockZerohash },
        // Note: we don’t bind AdapterConfigProvider in Nest,
        // because ParticipantAdapter does `new AdapterConfigProvider()`
      ],
    }).compile();

    adapter = module.get(ParticipantAdapter);
    // override the internal adapterConfig instance:
    (adapter as any).adapterConfig = mockConfigProvider;
    (adapter as any).zerohashParticipantAdapter = mockZerohash;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const basePayload = { country: 'US' } as ParticipantCreateRequest;
  const fakeResponse = { providerRef: 'PART123', provider: 'zerohash' };

  const depositAddressPayload = { userRef: 'PART123', asset: 'USDC.SOL' } as DepositAddressCreateRequest;
  const depositAddressResponse = {
    address: 'test-address-123',
    asset: 'USDC.SOL',
    userRef: 'PART123',
    createdAt: 1640995200000,
  } as DepositAddressCreateResponse;

  it('should be defined', () => {
    expect(adapter).toBeDefined();
  });

  it('for supported country calls Zerohash and returns its result', async () => {
    mockConfigProvider.getConfig.mockReturnValue({
      default_participant_countries: 'US,NG',
    });
    mockZerohash.createParticipant.mockResolvedValue(fakeResponse);

    const result = await adapter.createParticipant(basePayload);

    expect(mockZerohash.createParticipant).toHaveBeenCalledWith(basePayload);
    expect(result).toEqual(fakeResponse);
  });

  it('is case- and whitespace-insensitive when parsing countries list', async () => {
    mockConfigProvider.getConfig.mockReturnValue({
      default_participant_countries: ' us , ng ',
    });
    mockZerohash.createParticipant.mockResolvedValue(fakeResponse);

    const payload = { country: 'uS' } as ParticipantCreateRequest;
    const result = await adapter.createParticipant(payload);

    expect(mockZerohash.createParticipant).toHaveBeenCalledWith(payload);
    expect(result).toEqual(fakeResponse);
  });

  it('throws BadRequestException for unsupported country', async () => {
    mockConfigProvider.getConfig.mockReturnValue({
      default_participant_countries: 'NG,CA',
    });

    await expect(adapter.createParticipant(basePayload)).rejects.toThrow(BadRequestException);
    expect(mockZerohash.createParticipant).not.toHaveBeenCalled();
  });

  it('propagates errors thrown by the underlying adapter', async () => {
    mockConfigProvider.getConfig.mockReturnValue({
      default_participant_countries: 'US,NG',
    });
    const err = new Error('boom');
    mockZerohash.createParticipant.mockRejectedValue(err);

    await expect(adapter.createParticipant(basePayload)).rejects.toThrow(err);
    expect(mockZerohash.createParticipant).toHaveBeenCalledWith(basePayload);
  });

  describe('uploadKycDocument', () => {
    const documentPayload = {
      documentType: 'us_passport',
      document: 'base64content',
      mime: 'image/jpeg',
      fileName: 'passport.jpg',
      userRef: 'PART123',
      idFront: true,
      country: 'US',
    } as any;

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should upload KYC document for supported country', async () => {
      mockConfigProvider.getConfig.mockReturnValue({
        default_participant_countries: 'US,NG',
      });
      mockZerohash.uploadKycDocument.mockResolvedValue(undefined);

      await adapter.uploadKycDocument(documentPayload);

      expect(mockZerohash.uploadKycDocument).toHaveBeenCalledWith(documentPayload);
    });

    it('should handle missing uploadKycDocument method gracefully', async () => {
      mockConfigProvider.getConfig.mockReturnValue({
        default_participant_countries: 'US,NG',
      });

      // Create a mock adapter without uploadKycDocument method
      const mockAdapterWithoutUpload = {
        createParticipant: jest.fn(),
      };
      (adapter as any).getProvider = jest.fn().mockReturnValue(mockAdapterWithoutUpload);

      // Should not throw error, just log warning
      await expect(adapter.uploadKycDocument(documentPayload)).resolves.toBeUndefined();
    });

    it('should throw BadRequestException for unsupported country', async () => {
      mockConfigProvider.getConfig.mockReturnValue({
        default_participant_countries: 'NG',
      });

      await expect(adapter.uploadKycDocument(documentPayload)).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateParticipant', () => {
    const updatePayload = {
      userRef: 'PART123',
      platformUpdatedAt: 1234567890,
      idNumber: 'PASSPORT123',
      idNumberType: 'us_passport',
      livenessCheck: 'pass',
      idv: 'pass',
      taxIdNumber: '123456789',
      citizenshipCode: 'US',
    } as any;

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should update participant for supported country', async () => {
      mockConfigProvider.getConfig.mockReturnValue({
        default_participant_countries: 'US,NG',
      });
      mockZerohash.updateParticipant.mockResolvedValue(undefined);

      await adapter.updateParticipant(updatePayload);

      expect(mockZerohash.updateParticipant).toHaveBeenCalledWith(updatePayload);
    });

    it('should throw BadRequestException when updateParticipant method not supported', async () => {
      mockConfigProvider.getConfig.mockReturnValue({
        default_participant_countries: 'US,NG',
      });

      // Create a mock adapter without updateParticipant method
      const mockAdapterWithoutUpdate = {
        createParticipant: jest.fn(),
      };
      (adapter as any).getProvider = jest.fn().mockReturnValue(mockAdapterWithoutUpdate);

      await expect(adapter.updateParticipant(updatePayload)).rejects.toThrow(BadRequestException);
      await expect(adapter.updateParticipant(updatePayload)).rejects.toThrow(
        'Participant update not supported for country: US',
      );
    });

    it('should throw BadRequestException for unsupported country', async () => {
      mockConfigProvider.getConfig.mockReturnValue({
        default_participant_countries: 'NG',
      });

      await expect(adapter.updateParticipant(updatePayload)).rejects.toThrow(BadRequestException);
      await expect(adapter.updateParticipant(updatePayload)).rejects.toThrow(
        'Unsupported participant country for customer creation: US',
      );
    });
  });

  describe('createDepositAddress', () => {
    it('should call the appropriate provider and return its result', async () => {
      mockConfigProvider.getConfig.mockReturnValue({
        default_participant_countries: 'US,NG',
      });
      mockZerohash.createDepositAddress.mockResolvedValue(depositAddressResponse);

      const result = await adapter.createDepositAddress(depositAddressPayload, 'US');

      expect(mockZerohash.createDepositAddress).toHaveBeenCalledWith(depositAddressPayload);
      expect(result).toEqual(depositAddressResponse);
    });

    it('should propagate errors thrown by the provider adapter', async () => {
      mockConfigProvider.getConfig.mockReturnValue({
        default_participant_countries: 'US,NG',
      });
      const err = new Error('deposit address creation failed');
      mockZerohash.createDepositAddress.mockRejectedValue(err);

      await expect(adapter.createDepositAddress(depositAddressPayload, 'US')).rejects.toThrow(err);
      expect(mockZerohash.createDepositAddress).toHaveBeenCalledWith(depositAddressPayload);
    });

    it('should handle different asset types', async () => {
      mockConfigProvider.getConfig.mockReturnValue({
        default_participant_countries: 'US,NG',
      });
      const btcPayload = { userRef: 'PART123', asset: 'BTC' } as DepositAddressCreateRequest;
      const btcResponse = { ...depositAddressResponse, asset: 'BTC' };
      mockZerohash.createDepositAddress.mockResolvedValue(btcResponse);

      const result = await adapter.createDepositAddress(btcPayload, 'NG');

      expect(mockZerohash.createDepositAddress).toHaveBeenCalledWith(btcPayload);
      expect(result).toEqual(btcResponse);
    });

    it('should handle null asset parameter', async () => {
      mockConfigProvider.getConfig.mockReturnValue({
        default_participant_countries: 'US,NG',
      });
      const nullAssetPayload = { userRef: 'PART123', asset: null } as DepositAddressCreateRequest;
      mockZerohash.createDepositAddress.mockResolvedValue(depositAddressResponse);

      const result = await adapter.createDepositAddress(nullAssetPayload, 'US');

      expect(mockZerohash.createDepositAddress).toHaveBeenCalledWith(nullAssetPayload);
      expect(result).toEqual(depositAddressResponse);
    });

    it('should use ZeroHash adapter for supported countries', async () => {
      mockConfigProvider.getConfig.mockReturnValue({
        default_participant_countries: 'US,NG',
      });
      mockZerohash.createDepositAddress.mockResolvedValue(depositAddressResponse);

      const result = await adapter.createDepositAddress(depositAddressPayload, 'US');

      expect(mockZerohash.createDepositAddress).toHaveBeenCalledWith(depositAddressPayload);
      expect(result).toEqual(depositAddressResponse);
    });

    it('should throw BadRequestException for unsupported country', async () => {
      mockConfigProvider.getConfig.mockReturnValue({
        default_participant_countries: 'US,NG',
      });

      await expect(adapter.createDepositAddress(depositAddressPayload, 'CA')).rejects.toThrow(BadRequestException);
      expect(mockZerohash.createDepositAddress).not.toHaveBeenCalled();
    });
  });

  describe('getParticipantRef', () => {
    const getParticipantRefPayload = { email: 'test@example.com' };
    const getParticipantRefResponse = { ref: 'PART123', email: 'test@example.com', provider: 'zerohash' };

    it('should get participant ref for supported country', async () => {
      mockConfigProvider.getConfig.mockReturnValue({
        default_participant_countries: 'US,NG',
      });
      mockZerohash.getParticipantRef.mockResolvedValue(getParticipantRefResponse);

      const result = await adapter.getParticipantRef(getParticipantRefPayload, 'US');

      expect(mockZerohash.getParticipantRef).toHaveBeenCalledWith(getParticipantRefPayload);
      expect(result).toEqual(getParticipantRefResponse);
    });

    it('should throw BadRequestException for unsupported country', async () => {
      mockConfigProvider.getConfig.mockReturnValue({
        default_participant_countries: 'US,NG',
      });

      await expect(adapter.getParticipantRef(getParticipantRefPayload, 'CA')).rejects.toThrow(BadRequestException);
      expect(mockZerohash.getParticipantRef).not.toHaveBeenCalled();
    });
  });

  describe('getKycStatus', () => {
    const getKycStatusPayload = { userRef: 'PART123' };
    const getKycStatusResponse = {
      userRef: 'PART123',
      identityVerification: 'pass' as const,
      livenessVerification: 'pass' as const,
      taxIdNumberProvided: true,
      isEnhancedDueDiligence: false,
      tags: [],
      status: 'approved',
      verificationAttempts: 0,
      isEnhancedDueDiligenceRequired: false,
    };

    it('should get KYC status for supported country', async () => {
      mockConfigProvider.getConfig.mockReturnValue({
        default_participant_countries: 'US,NG',
      });
      mockZerohash.getKycStatus.mockResolvedValue(getKycStatusResponse);

      const result = await adapter.getKycStatus(getKycStatusPayload, 'US');

      expect(mockZerohash.getKycStatus).toHaveBeenCalledWith(getKycStatusPayload);
      expect(result).toEqual(getKycStatusResponse);
    });

    it('should throw BadRequestException for unsupported country', async () => {
      mockConfigProvider.getConfig.mockReturnValue({
        default_participant_countries: 'US,NG',
      });

      await expect(adapter.getKycStatus(getKycStatusPayload, 'CA')).rejects.toThrow(BadRequestException);
      expect(mockZerohash.getKycStatus).not.toHaveBeenCalled();
    });
  });
});
