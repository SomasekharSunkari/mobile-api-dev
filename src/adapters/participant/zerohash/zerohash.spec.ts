import { BadGatewayException } from '@nestjs/common';
import * as crypto from 'crypto';
import { ParticipantCreateRequest, ParticipantCreateResponse } from '../participant.adapter.interface';
import { ZerohashParticipantAdapter } from './zerohash.adapter';
import { ZerohashAxiosHelper } from './zerohash.axios';
import { NigerianStateCode } from './zerohash.interface';

describe('ZerohashParticipantAdapter', () => {
  let adapter: ZerohashParticipantAdapter;

  const usPayload: ParticipantCreateRequest = {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    address: '123 Main St',
    city: 'New York',
    state: 'NY',
    country: 'US',
    dob: '1990-01-01',
    kyc: 'pass',
    kycTimestamp: Date.now(),
    compliance: 'pass',
    complianceTimestamp: Date.now(),
    signedTimestamp: Date.now(),
    zip: '10001',
    tin: '123-45-6789', // SSN for US users
  };

  const ngPayload: ParticipantCreateRequest = {
    firstName: 'Adebayo',
    lastName: 'Okunola',
    email: 'adebayo@example.com',
    address: '123 Allen Avenue',
    city: 'lagos',
    state: 'lagos', // This should be mapped to 'LA'
    country: 'NG',
    dob: '1990-01-01',
    kyc: 'pass',
    kycTimestamp: Date.now(),
    compliance: 'pass',
    complianceTimestamp: Date.now(),
    signedTimestamp: Date.now(),
    tin: '12345678901', // BVN for NG users
    passport: 'A12345678',
    document: 'base64Document',
    documentType: 'non_us_passport',
    fileType: 'image/jpeg',
    fileName: 'passport.jpg',
    idFront: true,
  };

  beforeEach(() => {
    adapter = new ZerohashParticipantAdapter();

    // stub out post(), get(), and patch() methods
    jest.spyOn(adapter, 'post');
    jest.spyOn(adapter, 'get');
    jest.spyOn(adapter, 'patch');
  });

  it('should create a US customer and return providerRef', async () => {
    // simulate zerohash POST returning a wrapped response.payload.message.participant_code
    const fakeResponse = { data: { message: { participant_code: 'PART123' } } };
    (adapter.post as jest.Mock).mockResolvedValueOnce(fakeResponse);

    const result: ParticipantCreateResponse = await adapter.createParticipant(usPayload);

    expect(adapter.post).toHaveBeenCalledWith(
      '/participants/customers/new',
      expect.objectContaining({
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        zip: '10001',
        tax_id: '123-45-6789',
        citizenship_code: 'US',
        jurisdiction_code: 'US-NY',
      }),
    );

    expect(result).toEqual({ providerRef: 'PART123', provider: 'zerohash' });
  });

  it('should create a Nigerian customer with correct state mapping for Lagos', async () => {
    const fakeResponse = { data: { message: { participant_code: 'NGPART123' } } };
    (adapter.post as jest.Mock).mockResolvedValueOnce(fakeResponse);

    const result: ParticipantCreateResponse = await adapter.createParticipant(ngPayload);

    expect(adapter.post).toHaveBeenCalledWith(
      '/participants/customers/new',
      expect.objectContaining({
        first_name: 'Adebayo',
        last_name: 'Okunola',
        email: 'adebayo@example.com',
        city: 'lagos',
        jurisdiction_code: 'NG-LA', // Should be mapped correctly from 'lagos' to 'LA'
        citizenship_code: 'NG',
        id_number_type: 'non_us_other',
        id_number: '12345678901', // BVN from tin field
        non_us_other_type: 'BVN', // Bank Verification Number type
      }),
    );

    expect(result).toEqual({ providerRef: 'NGPART123', provider: 'zerohash' });
  });

  it('should map various Nigerian cities to correct state codes', async () => {
    const validTestCases = [
      { input: 'lagos', expected: NigerianStateCode.LA },
      { input: 'ikeja', expected: NigerianStateCode.LA },
      { input: 'lekki', expected: NigerianStateCode.LA },
      { input: 'abuja', expected: NigerianStateCode.FC },
      { input: 'fct', expected: NigerianStateCode.FC },
      { input: 'kano', expected: NigerianStateCode.KN },
      { input: 'kaduna', expected: NigerianStateCode.KD },
      { input: 'kaduna state', expected: NigerianStateCode.KD },
    ];

    const fakeResponse = { data: { message: { participant_code: 'TEST123' } } };

    for (const testCase of validTestCases) {
      // Reset mock calls for each test case
      jest.clearAllMocks();
      (adapter.post as jest.Mock).mockResolvedValueOnce(fakeResponse);

      const testPayload = { ...ngPayload, state: testCase.input, city: testCase.input };
      await adapter.createParticipant(testPayload);

      expect(adapter.post).toHaveBeenCalledWith(
        '/participants/customers/new',
        expect.objectContaining({
          jurisdiction_code: `NG-${testCase.expected}`,
        }),
      );
    }
  });

  it('should throw BadGatewayException for unknown Nigerian cities', async () => {
    const testPayload = { ...ngPayload, state: 'unknown-city', city: 'unknown-city' };

    await expect(adapter.createParticipant(testPayload)).rejects.toThrow(BadGatewayException);
    await expect(adapter.createParticipant(testPayload)).rejects.toThrow('Invalid Nigerian state/city: unknown-city');

    expect(adapter.post).not.toHaveBeenCalled();
  });

  it('should throw BadGatewayException for missing Nigerian state/city', async () => {
    const testPayload = { ...ngPayload, state: '', city: '' };

    await expect(adapter.createParticipant(testPayload)).rejects.toThrow(BadGatewayException);
    await expect(adapter.createParticipant(testPayload)).rejects.toThrow(
      'Nigerian state/city is required but not provided',
    );

    expect(adapter.post).not.toHaveBeenCalled();
  });

  it('should throw BadGatewayException for unsupported country', async () => {
    await expect(adapter.createParticipant({ ...usPayload, country: 'FR' } as any)).rejects.toThrow(
      BadGatewayException,
    );

    expect(adapter.post).not.toHaveBeenCalled();
  });

  it('should rethrow any Axios error as BadGatewayException', async () => {
    const err = new Error('network');
    // attach a fake response to simulate axios error.response
    (err as any).response = { status: 502, data: { problem: 'down' } };
    (adapter.post as jest.Mock).mockRejectedValueOnce(err);

    await expect(adapter.createParticipant(usPayload)).rejects.toThrow(BadGatewayException);
    expect(adapter.post).toHaveBeenCalled();
  });

  describe('getParticipantRef', () => {
    it('should get participant ref successfully', async () => {
      const mockResponse = {
        data: {
          message: {
            participant_code: 'PART123',
            email: 'test@example.com',
          },
        },
        status: 200,
      };
      (adapter.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await adapter.getParticipantRef({ email: 'test@example.com' });

      expect(adapter.get).toHaveBeenCalledWith('/participants/test@example.com', {
        validateStatus: expect.any(Function),
      });
      expect(result).toEqual({
        ref: 'PART123',
        email: 'test@example.com',
        provider: 'zerohash',
      });
    });

    it('should handle 404 response', async () => {
      const mockResponse = {
        data: {
          message: {
            email: 'test@example.com',
          },
        },
        status: 404,
      };
      (adapter.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await adapter.getParticipantRef({ email: 'test@example.com' });

      expect(result).toEqual({
        ref: null,
        email: 'test@example.com',
        provider: 'zerohash',
      });
    });
  });

  describe('uploadKycDocument', () => {
    it('should upload document successfully', async () => {
      const mockPayload = {
        documentType: 'us_passport',
        document: 'base64content',
        mime: 'image/jpeg',
        fileName: 'passport.jpg',
        userRef: 'PART123',
        idFront: true,
        country: 'US',
      };

      (adapter.post as jest.Mock).mockResolvedValue({ data: { success: true } });

      await adapter.uploadKycDocument(mockPayload);

      expect(adapter.post).toHaveBeenCalledWith(
        '/participants/documents',
        {
          document_type: 'us_passport',
          document: 'base64content',
          mime: 'image/jpeg',
          file_name: 'passport.jpg',
          participant_code: 'PART123',
          id_front: true,
        },
        {
          headers: {
            'X-SCX-FILE-HASH': expect.any(String),
          },
        },
      );
    });
  });

  describe('updateParticipant', () => {
    it('should update participant successfully', async () => {
      const mockPayload = {
        userRef: 'PART123',
        platformUpdatedAt: 1234567890,
        idNumber: 'PASSPORT123',
        idNumberType: 'us_passport',
        livenessCheck: 'pass',
        idv: 'pass',
        taxIdNumber: '123456789',
        citizenshipCode: 'US',
      };

      (adapter.patch as jest.Mock).mockResolvedValue({ data: { success: true } });

      await adapter.updateParticipant(mockPayload);

      expect(adapter.patch).toHaveBeenCalledWith(
        '/participants/customers/PART123',
        expect.objectContaining({
          platform_updated_at: 1234567890,
          id_number: 'PASSPORT123',
          id_number_type: 'us_passport',
          liveness_check: 'pass',
          idv: 'pass',
          tax_id: '123456789',
          citizenship_code: 'US',
        }),
      );
    });
  });

  describe('createDepositAddress', () => {
    it('should create deposit address successfully', async () => {
      const mockPayload = {
        userRef: 'PART123',
        asset: 'USDC.SOL',
      };

      const mockResponse = {
        data: {
          message: {
            address: 'test-address-123',
            asset: 'USDC.SOL',
            participant_code: 'PART123',
            created_at: 1640995200000,
          },
        },
      };

      (adapter.post as jest.Mock).mockResolvedValue(mockResponse);

      const result = await adapter.createDepositAddress(mockPayload);

      expect(adapter.post).toHaveBeenCalledWith('/deposits/digital_asset_addresses', {
        participant_code: 'PART123',
        asset: 'USDC.SOL',
      });

      expect(result).toEqual({
        address: 'test-address-123',
        asset: 'USDC.SOL',
        userRef: 'PART123',
        createdAt: 1640995200000,
      });
    });
  });

  describe('getDepositAddress', () => {
    it('should get deposit address successfully when found', async () => {
      const mockPayload = {
        participantCode: 'PART123',
        asset: 'USDC.ETH',
      };

      const mockResponse = {
        data: {
          message: [
            {
              address: '0x2a0a4c216E785840a4F9ba529d7136f1239B1320',
              asset: 'USDC.ETH',
              participant_code: 'PART123',
              account_label: 'general',
              platform_code: 'LNPWRG',
              created_at: 1768582410000,
            },
          ],
        },
      };

      (adapter.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await adapter.getDepositAddress(mockPayload);

      expect(adapter.get).toHaveBeenCalledWith(
        '/deposits/digital_asset_addresses?participant_code=PART123&asset=USDC.ETH',
      );

      expect(result).toEqual({
        address: '0x2a0a4c216E785840a4F9ba529d7136f1239B1320',
        asset: 'USDC.ETH',
      });
    });

    it('should return empty object when no deposit address found', async () => {
      const mockPayload = {
        participantCode: 'PART123',
        asset: 'USDC.ETH',
      };

      const mockResponse = {
        data: {
          message: [],
        },
      };

      (adapter.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await adapter.getDepositAddress(mockPayload);

      expect(adapter.get).toHaveBeenCalledWith(
        '/deposits/digital_asset_addresses?participant_code=PART123&asset=USDC.ETH',
      );

      expect(result).toEqual({});
    });

    it('should throw BadGatewayException on API error', async () => {
      const mockPayload = {
        participantCode: 'PART123',
        asset: 'USDC.ETH',
      };

      const error = new Error('API Error');
      (error as any).response = { status: 500, data: { error: 'Internal Server Error' } };
      (adapter.get as jest.Mock).mockRejectedValue(error);

      await expect(adapter.getDepositAddress(mockPayload)).rejects.toThrow(BadGatewayException);
      expect(adapter.get).toHaveBeenCalledWith(
        '/deposits/digital_asset_addresses?participant_code=PART123&asset=USDC.ETH',
      );
    });
  });

  describe('getKycStatus', () => {
    const mockKycStatusResponse = {
      data: {
        message: {
          participant_code: 'PXV0YV',
          idv: 'pass' as const,
          liveness_check: 'pass' as const,
          tax_id: true,
          edd: false,
          tags: [],
          participant_status: 'approved',
          kyc_attempts: 0,
          edd_required: false,
        },
      },
    };

    beforeEach(() => {
      (adapter.get as jest.Mock).mockResolvedValue(mockKycStatusResponse);
    });

    it('should get KYC status successfully', async () => {
      const payload = { userRef: 'PXV0YV' };
      const result = await adapter.getKycStatus(payload);

      expect(adapter.get).toHaveBeenCalledWith('/participant/PXV0YV/kyc_status');
      expect(result).toEqual({
        userRef: 'PXV0YV',
        identityVerification: 'pass',
        livenessVerification: 'pass',
        taxIdNumberProvided: true,
        isEnhancedDueDiligence: false,
        tags: [],
        status: 'approved',
        verificationAttempts: 0,
        isEnhancedDueDiligenceRequired: false,
      });
    });

    it('should handle KYC status with different verification states', async () => {
      const mockResponse = {
        data: {
          message: {
            participant_code: 'ABC123',
            idv: 'fail' as const,
            liveness_check: 'unknown' as const,
            tax_id: false,
            edd: true,
            tags: ['high_risk'],
            participant_status: 'pending',
            kyc_attempts: 2,
            edd_required: true,
          },
        },
      };
      (adapter.get as jest.Mock).mockResolvedValue(mockResponse);

      const payload = { userRef: 'ABC123' };
      const result = await adapter.getKycStatus(payload);

      expect(result).toEqual({
        userRef: 'ABC123',
        identityVerification: 'fail',
        livenessVerification: 'unknown',
        taxIdNumberProvided: false,
        isEnhancedDueDiligence: true,
        tags: ['high_risk'],
        status: 'pending',
        verificationAttempts: 2,
        isEnhancedDueDiligenceRequired: true,
      });
    });

    it('should throw BadGatewayException on API error', async () => {
      const error = new Error('API Error');
      (error as any).response = { status: 404, data: { error: 'Not found' } };
      (adapter.get as jest.Mock).mockRejectedValue(error);

      const payload = { userRef: 'INVALID' };

      await expect(adapter.getKycStatus(payload)).rejects.toThrow(BadGatewayException);
      expect(adapter.get).toHaveBeenCalledWith('/participant/INVALID/kyc_status');
    });
  });
});

describe('ZerohashAxiosHelper', () => {
  let helper: ZerohashAxiosHelper;
  let requestSpy: jest.Mock;
  let getSpy: jest.Mock;
  let postSpy: jest.Mock;
  let patchSpy: jest.Mock;

  beforeEach(() => {
    helper = new ZerohashAxiosHelper();

    // override the readonly configProvider via defineProperty
    Object.defineProperty(helper, 'configProvider', {
      value: {
        getConfig: () => ({
          apiKey: 'KEY',
          apiPassphrase: 'PASS',
          apiSecret: Buffer.from('secret').toString('base64'),
          apiUrl: 'https://api.test',
        }),
      },
    });

    // stub out axiosInstance methods
    requestSpy = jest.fn().mockResolvedValue({ data: { ok: true }, status: 200 });
    getSpy = jest.fn().mockResolvedValue({ data: { ok: true }, status: 200 });
    postSpy = jest.fn().mockResolvedValue({ data: { ok: true }, status: 200 });
    patchSpy = jest.fn().mockResolvedValue({ data: { ok: true }, status: 200 });

    Object.defineProperty(helper, 'axiosInstance', {
      value: {
        request: requestSpy,
        get: getSpy,
        post: postSpy,
        patch: patchSpy,
      },
    });
  });

  it('get() should include correct headers and return the response', async () => {
    const resp = await helper.get('/foo');
    // ensure we forwarded through to axiosInstance.get
    expect(getSpy).toHaveBeenCalledWith(
      '/foo',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-SCX-API-KEY': 'KEY',
          'X-SCX-TIMESTAMP': expect.any(String),
          'X-SCX-SIGNED': expect.any(String),
          'X-SCX-PASSPHRASE': 'PASS',
        }),
      }),
    );
    expect(resp).toEqual({ data: { ok: true }, status: 200 });
  });

  it('post() should sign payload, include extra headers and proxy, then return the response', async () => {
    // spy on crypto.createHmac so signature is predictable
    const fakeHmac = { update: () => ({ digest: () => 'SIG' }) } as any;
    jest.spyOn(crypto, 'createHmac').mockReturnValue(fakeHmac);

    const out = await helper.post('/bar', { a: 1 }, { headers: { 'X-FOO': 'BAR' } });
    expect(postSpy).toHaveBeenCalledWith(
      '/bar',
      { a: 1 },
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-SCX-API-KEY': 'KEY',
          'X-SCX-TIMESTAMP': expect.any(String),
          'X-SCX-SIGNED': 'SIG',
          'X-SCX-PASSPHRASE': 'PASS',
          'X-FOO': 'BAR',
        }),
      }),
    );
    expect(out).toEqual({ data: { ok: true }, status: 200 });
  });
});

// Import the mapping functions for testing
import { ZerohashHelper } from './zerohash.helper';

describe('ZerohashHelper', () => {
  describe('mapEmploymentStatusToZeroHash', () => {
    it('should map employed to full_time', () => {
      expect(ZerohashHelper.mapEmploymentStatusToZeroHash('employed')).toBe('full_time');
    });

    it('should map self_employed to self_employed', () => {
      expect(ZerohashHelper.mapEmploymentStatusToZeroHash('self_employed')).toBe('self_employed');
    });

    it('should map homemaker to unemployed', () => {
      expect(ZerohashHelper.mapEmploymentStatusToZeroHash('homemaker')).toBe('unemployed');
    });

    it('should map unemployed to unemployed', () => {
      expect(ZerohashHelper.mapEmploymentStatusToZeroHash('unemployed')).toBe('unemployed');
    });

    it('should map student to student', () => {
      expect(ZerohashHelper.mapEmploymentStatusToZeroHash('student')).toBe('student');
    });

    it('should map retired to retired', () => {
      expect(ZerohashHelper.mapEmploymentStatusToZeroHash('retired')).toBe('retired');
    });

    it('should return undefined for unknown employment status', () => {
      expect(ZerohashHelper.mapEmploymentStatusToZeroHash('unknown_status')).toBeUndefined();
    });
  });

  describe('mapSourceOfFundsToZeroHash', () => {
    it('should map salary to salary', () => {
      expect(ZerohashHelper.mapSourceOfFundsToZeroHash('salary')).toBe('salary');
    });

    it('should map savings to savings', () => {
      expect(ZerohashHelper.mapSourceOfFundsToZeroHash('savings')).toBe('savings');
    });

    it('should map pension_retirement to pension_retirement', () => {
      expect(ZerohashHelper.mapSourceOfFundsToZeroHash('pension_retirement')).toBe('pension_retirement');
    });

    it('should map inheritance to inheritance', () => {
      expect(ZerohashHelper.mapSourceOfFundsToZeroHash('inheritance')).toBe('inheritance');
    });

    it('should map investment to investment', () => {
      expect(ZerohashHelper.mapSourceOfFundsToZeroHash('investment')).toBe('investment');
    });

    it('should map loan to loan', () => {
      expect(ZerohashHelper.mapSourceOfFundsToZeroHash('loan')).toBe('loan');
    });

    it('should map gift to gift', () => {
      expect(ZerohashHelper.mapSourceOfFundsToZeroHash('gift')).toBe('gift');
    });

    it('should map gifts to gift', () => {
      expect(ZerohashHelper.mapSourceOfFundsToZeroHash('gifts')).toBe('gift');
    });

    it('should map company_funds to other', () => {
      expect(ZerohashHelper.mapSourceOfFundsToZeroHash('company_funds')).toBe('other');
    });

    it('should map ecommerce_reseller to other', () => {
      expect(ZerohashHelper.mapSourceOfFundsToZeroHash('ecommerce_reseller')).toBe('other');
    });

    it('should map gambling_proceeds to other', () => {
      expect(ZerohashHelper.mapSourceOfFundsToZeroHash('gambling_proceeds')).toBe('other');
    });

    it('should map government_benefits to other', () => {
      expect(ZerohashHelper.mapSourceOfFundsToZeroHash('government_benefits')).toBe('other');
    });

    it('should map investments_loans to investment', () => {
      expect(ZerohashHelper.mapSourceOfFundsToZeroHash('investments_loans')).toBe('investment');
    });

    it('should map sale_of_assets_real_estate to other', () => {
      expect(ZerohashHelper.mapSourceOfFundsToZeroHash('sale_of_assets_real_estate')).toBe('other');
    });

    it('should map someone_elses_funds to other', () => {
      expect(ZerohashHelper.mapSourceOfFundsToZeroHash('someone_elses_funds')).toBe('other');
    });

    it('should return undefined for unknown source of funds', () => {
      expect(ZerohashHelper.mapSourceOfFundsToZeroHash('unknown_source')).toBeUndefined();
    });
  });

  describe('mapOccupationToIndustry', () => {
    it('should map Software developer to other (no specific tech category)', () => {
      expect(ZerohashHelper.mapOccupationToIndustry('Software developer')).toBe('other');
    });

    it('should map Accountant and auditor to financial_services', () => {
      expect(ZerohashHelper.mapOccupationToIndustry('Accountant and auditor')).toBe('financial_services');
    });

    it('should map Teacher to education', () => {
      expect(ZerohashHelper.mapOccupationToIndustry('Teacher')).toBe('education');
    });

    it('should map Nurse to pharmaceuticals', () => {
      expect(ZerohashHelper.mapOccupationToIndustry('Nurse')).toBe('pharmaceuticals');
    });

    it('should map Engineer to other (too broad)', () => {
      expect(ZerohashHelper.mapOccupationToIndustry('Engineer')).toBe('other');
    });

    it('should map Lawyer to legal_services', () => {
      expect(ZerohashHelper.mapOccupationToIndustry('Lawyer')).toBe('legal_services');
    });

    it('should map Doctor to pharmaceuticals', () => {
      expect(ZerohashHelper.mapOccupationToIndustry('Doctor')).toBe('pharmaceuticals');
    });

    it('should map Sales representative to other (too broad)', () => {
      expect(ZerohashHelper.mapOccupationToIndustry('Sales representative')).toBe('other');
    });

    it('should map Manager to other (too broad)', () => {
      expect(ZerohashHelper.mapOccupationToIndustry('Manager')).toBe('other');
    });

    it('should map Marketing specialist to advertising_media_marketing', () => {
      expect(ZerohashHelper.mapOccupationToIndustry('Marketing specialist')).toBe('advertising_media_marketing');
    });

    it('should return other for unknown occupation', () => {
      expect(ZerohashHelper.mapOccupationToIndustry('Unknown Occupation')).toBe('other');
    });

    it('should return other for empty string', () => {
      expect(ZerohashHelper.mapOccupationToIndustry('')).toBe('other');
    });
  });
});
