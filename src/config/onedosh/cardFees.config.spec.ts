import {
  CardFeeCalculationType,
  CardFeeType,
  CardFeesService,
  MAX_TRANSACTION_AMOUNT,
  MINIMUM_CHARGE_API_FEE,
} from './cardFees.config';

describe('CardFeesConfig', () => {
  describe('CardFeeType enum', () => {
    it('should have all expected fee types', () => {
      expect(CardFeeType.DOMESTIC_PURCHASE).toBe('domestic_purchase');
      expect(CardFeeType.CROSS_BORDER_FX).toBe('cross_border_fx');
      expect(CardFeeType.INSUFFICIENT_FUNDS).toBe('insufficient_funds');
      expect(CardFeeType.FIAT_TOP_UP).toBe('fiat_top_up');
      expect(CardFeeType.STABLECOIN_TOP_UP).toBe('stablecoin_top_up');
      expect(CardFeeType.ATM_BALANCE_INQUIRY).toBe('atm_balance_inquiry');
      expect(CardFeeType.ATM_DECLINE).toBe('atm_decline');
      expect(CardFeeType.ATM_WITHDRAWAL).toBe('atm_withdrawal');
      expect(CardFeeType.PHYSICAL_CARD_FIRST_ISSUE).toBe('physical_card_first_issue');
      expect(CardFeeType.PHYSICAL_CARD_REPLACEMENT).toBe('physical_card_replacement');
      expect(CardFeeType.VIRTUAL_CARD_ISSUANCE).toBe('virtual_card_issuance');
      expect(CardFeeType.DISPUTE_CHARGEBACK).toBe('dispute_chargeback');
    });
  });

  describe('CardFeeCalculationType enum', () => {
    it('should have all expected calculation types', () => {
      expect(CardFeeCalculationType.PERCENTAGE).toBe('percentage');
      expect(CardFeeCalculationType.FIXED).toBe('fixed');
      expect(CardFeeCalculationType.PERCENTAGE_PLUS_FIXED).toBe('percentage_plus_fixed');
      expect(CardFeeCalculationType.NONE).toBe('none');
    });
  });

  describe('MAX_TRANSACTION_AMOUNT', () => {
    it('should be undefined to disable the cap', () => {
      expect(MAX_TRANSACTION_AMOUNT).toBeUndefined();
    });
  });

  describe('MINIMUM_CHARGE_API_FEE', () => {
    it('should be 0.01 (1 cent)', () => {
      expect(MINIMUM_CHARGE_API_FEE).toBe(0.01);
    });
  });

  describe('CardFeesService', () => {
    describe('getFeeConfig', () => {
      it('should return fee config for existing fee type', () => {
        const config = CardFeesService.getFeeConfig(CardFeeType.DOMESTIC_PURCHASE);
        expect(config).toBeDefined();
        expect(config?.feeType).toBe(CardFeeType.DOMESTIC_PURCHASE);
        expect(config?.calculationType).toBe(CardFeeCalculationType.NONE);
      });

      it('should return undefined for non-existing fee type', () => {
        const config = CardFeesService.getFeeConfig('non_existing_type' as CardFeeType);
        expect(config).toBeUndefined();
      });

      it('should return config for all fee types', () => {
        const allFeeTypes = Object.values(CardFeeType);
        allFeeTypes.forEach((feeType) => {
          const config = CardFeesService.getFeeConfig(feeType);
          expect(config).toBeDefined();
          expect(config?.feeType).toBe(feeType);
        });
      });
    });

    describe('calculateFee', () => {
      it('should return zero fee when fee config is not found', () => {
        const result = CardFeesService.calculateFee(100, 'non_existing_type' as CardFeeType);
        expect(result.fee).toBe(0);
        expect(result.feeType).toBe(CardFeeCalculationType.NONE);
        expect(result.feePercentage).toBeUndefined();
        expect(result.feeFixed).toBeUndefined();
      });

      it('should calculate fee for PERCENTAGE type', () => {
        const result = CardFeesService.calculateFee(1000, CardFeeType.CROSS_BORDER_FX);
        expect(result.fee).toBe(20);
        expect(result.feePercentage).toBe(2);
        expect(result.feeFixed).toBeUndefined();
        expect(result.feeType).toBe(CardFeeCalculationType.PERCENTAGE);
      });

      it('should calculate fee for PERCENTAGE type with zero amount', () => {
        const result = CardFeesService.calculateFee(0, CardFeeType.CROSS_BORDER_FX);
        expect(result.fee).toBe(0);
        expect(result.feePercentage).toBe(2);
      });

      it('should calculate fee for FIXED type', () => {
        const result = CardFeesService.calculateFee(1000, CardFeeType.INSUFFICIENT_FUNDS);
        expect(result.fee).toBe(0.25);
        expect(result.feeFixed).toBe(0.25);
        expect(result.feePercentage).toBeUndefined();
        expect(result.feeType).toBe(CardFeeCalculationType.FIXED);
      });

      it('should calculate fee for FIXED type with zero amount', () => {
        const result = CardFeesService.calculateFee(0, CardFeeType.INSUFFICIENT_FUNDS);
        expect(result.fee).toBe(0.25);
        expect(result.feeFixed).toBe(0.25);
      });

      it('should calculate fee for PERCENTAGE_PLUS_FIXED type', () => {
        const result = CardFeesService.calculateFee(1000, CardFeeType.ATM_WITHDRAWAL);
        expect(result.fee).toBe(9.5);
        expect(result.feePercentage).toBe(0.75);
        expect(result.feeFixed).toBe(2);
        expect(result.feeType).toBe(CardFeeCalculationType.PERCENTAGE_PLUS_FIXED);
      });

      it('should calculate fee for PERCENTAGE_PLUS_FIXED type with zero amount', () => {
        const result = CardFeesService.calculateFee(0, CardFeeType.ATM_WITHDRAWAL);
        expect(result.fee).toBe(2);
        expect(result.feePercentage).toBe(0.75);
        expect(result.feeFixed).toBe(2);
      });

      it('should handle PERCENTAGE_PLUS_FIXED when fixed is falsy', () => {
        jest.spyOn(CardFeesService, 'getFeeConfig').mockReturnValueOnce({
          feeType: CardFeeType.ATM_WITHDRAWAL,
          calculationType: CardFeeCalculationType.PERCENTAGE_PLUS_FIXED,
          percentage: 1,
          fixed: undefined,
          description: 'Test',
          comment: 'Test',
          appliedBy: 'platform',
        });
        const result = CardFeesService.calculateFee(100, CardFeeType.ATM_WITHDRAWAL);
        expect(result.fee).toBe(1);
        expect(result.feePercentage).toBe(1);
        expect(result.feeFixed).toBeUndefined();
        jest.restoreAllMocks();
      });

      it('should calculate fee for NONE type', () => {
        const result = CardFeesService.calculateFee(1000, CardFeeType.DOMESTIC_PURCHASE);
        expect(result.fee).toBe(0);
        expect(result.feeType).toBe(CardFeeCalculationType.NONE);
        expect(result.feePercentage).toBeUndefined();
        expect(result.feeFixed).toBeUndefined();
      });

      it('should calculate fee for FIAT_TOP_UP', () => {
        const result = CardFeesService.calculateFee(1000, CardFeeType.FIAT_TOP_UP);
        expect(result.fee).toBe(5);
        expect(result.feePercentage).toBe(0.5);
        expect(result.feeType).toBe(CardFeeCalculationType.PERCENTAGE);
      });

      it('should calculate fee for STABLECOIN_TOP_UP', () => {
        const result = CardFeesService.calculateFee(1000, CardFeeType.STABLECOIN_TOP_UP);
        expect(result.fee).toBe(5);
        expect(result.feePercentage).toBe(0.5);
        expect(result.feeType).toBe(CardFeeCalculationType.PERCENTAGE);
      });

      it('should calculate fee for ATM_BALANCE_INQUIRY', () => {
        const result = CardFeesService.calculateFee(1000, CardFeeType.ATM_BALANCE_INQUIRY);
        expect(result.fee).toBe(1);
        expect(result.feeFixed).toBe(1);
        expect(result.feeType).toBe(CardFeeCalculationType.FIXED);
      });

      it('should calculate fee for ATM_DECLINE', () => {
        const result = CardFeesService.calculateFee(1000, CardFeeType.ATM_DECLINE);
        expect(result.fee).toBe(1);
        expect(result.feeFixed).toBe(1);
        expect(result.feeType).toBe(CardFeeCalculationType.FIXED);
      });

      it('should calculate fee for PHYSICAL_CARD_FIRST_ISSUE', () => {
        const result = CardFeesService.calculateFee(1000, CardFeeType.PHYSICAL_CARD_FIRST_ISSUE);
        expect(result.fee).toBe(0);
        expect(result.feeFixed).toBeUndefined();
        expect(result.feeType).toBe(CardFeeCalculationType.FIXED);
      });

      it('should calculate fee for PHYSICAL_CARD_REPLACEMENT', () => {
        const result = CardFeesService.calculateFee(1000, CardFeeType.PHYSICAL_CARD_REPLACEMENT);
        expect(result.fee).toBe(0);
        expect(result.feeFixed).toBeUndefined();
        expect(result.feeType).toBe(CardFeeCalculationType.FIXED);
      });

      it('should calculate fee for VIRTUAL_CARD_ISSUANCE', () => {
        const result = CardFeesService.calculateFee(1000, CardFeeType.VIRTUAL_CARD_ISSUANCE);
        expect(result.fee).toBe(1);
        expect(result.feeFixed).toBe(1);
        expect(result.feeType).toBe(CardFeeCalculationType.FIXED);
      });

      it('should calculate fee for DISPUTE_CHARGEBACK', () => {
        const result = CardFeesService.calculateFee(1000, CardFeeType.DISPUTE_CHARGEBACK);
        expect(result.fee).toBe(30);
        expect(result.feeFixed).toBe(30);
        expect(result.feeType).toBe(CardFeeCalculationType.FIXED);
      });
    });

    describe('getAllFeeConfigs', () => {
      it('should return all fee configurations', () => {
        const configs = CardFeesService.getAllFeeConfigs();
        expect(configs).toBeDefined();
        expect(Array.isArray(configs)).toBe(true);
        expect(configs.length).toBeGreaterThan(0);
        const allFeeTypes = Object.values(CardFeeType);
        expect(configs.length).toBe(allFeeTypes.length);
      });

      it('should return all fee types', () => {
        const configs = CardFeesService.getAllFeeConfigs();
        const feeTypes = configs.map((config) => config.feeType);
        const allFeeTypes = Object.values(CardFeeType);
        expect(feeTypes.length).toBe(allFeeTypes.length);
        allFeeTypes.forEach((feeType) => {
          expect(feeTypes).toContain(feeType);
        });
      });
    });

    describe('getFeeConfigsByAppliedBy', () => {
      it('should return configs applied by rain', () => {
        const configs = CardFeesService.getFeeConfigsByAppliedBy('rain');
        expect(configs).toBeDefined();
        expect(Array.isArray(configs)).toBe(true);
        configs.forEach((config) => {
          expect(config.appliedBy).toBe('rain');
        });
      });

      it('should return configs applied by platform', () => {
        const configs = CardFeesService.getFeeConfigsByAppliedBy('platform');
        expect(configs).toBeDefined();
        expect(Array.isArray(configs)).toBe(true);
        configs.forEach((config) => {
          expect(config.appliedBy).toBe('platform');
        });
      });

      it('should return configs applied by both', () => {
        const configs = CardFeesService.getFeeConfigsByAppliedBy('both');
        expect(configs).toBeDefined();
        expect(Array.isArray(configs)).toBe(true);
        configs.forEach((config) => {
          expect(config.appliedBy).toBe('both');
        });
      });

      it('should return empty array when no configs match', () => {
        const allConfigs = CardFeesService.getAllFeeConfigs();
        const hasBoth = allConfigs.some((config) => config.appliedBy === 'both');
        if (!hasBoth) {
          const configs = CardFeesService.getFeeConfigsByAppliedBy('both');
          expect(configs).toEqual([]);
        }
      });
    });

    describe('requiresChargeApi', () => {
      it('should return true for fee types that require charge API', () => {
        expect(CardFeesService.requiresChargeApi(CardFeeType.INSUFFICIENT_FUNDS)).toBe(true);
        expect(CardFeesService.requiresChargeApi(CardFeeType.FIAT_TOP_UP)).toBe(true);
        expect(CardFeesService.requiresChargeApi(CardFeeType.STABLECOIN_TOP_UP)).toBe(true);
        expect(CardFeesService.requiresChargeApi(CardFeeType.PHYSICAL_CARD_FIRST_ISSUE)).toBe(true);
        expect(CardFeesService.requiresChargeApi(CardFeeType.PHYSICAL_CARD_REPLACEMENT)).toBe(true);
        expect(CardFeesService.requiresChargeApi(CardFeeType.DISPUTE_CHARGEBACK)).toBe(true);
      });

      it('should return false for fee types that do not require charge API', () => {
        expect(CardFeesService.requiresChargeApi(CardFeeType.DOMESTIC_PURCHASE)).toBe(false);
        expect(CardFeesService.requiresChargeApi(CardFeeType.CROSS_BORDER_FX)).toBe(false);
        expect(CardFeesService.requiresChargeApi(CardFeeType.ATM_BALANCE_INQUIRY)).toBe(false);
        expect(CardFeesService.requiresChargeApi(CardFeeType.ATM_DECLINE)).toBe(false);
        expect(CardFeesService.requiresChargeApi(CardFeeType.ATM_WITHDRAWAL)).toBe(false);
      });

      it('should return true for VIRTUAL_CARD_ISSUANCE', () => {
        expect(CardFeesService.requiresChargeApi(CardFeeType.VIRTUAL_CARD_ISSUANCE)).toBe(true);
      });

      it('should return false for non-existing fee type', () => {
        const result = CardFeesService.requiresChargeApi('non_existing_type' as CardFeeType);
        expect(result).toBe(false);
      });
    });
  });
});
