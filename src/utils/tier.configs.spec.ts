import { NGN_TIER_CONFIG, NGNTierLevel, USA_TIER_CONFIG, USATierLevel } from './tier.configs';

describe('Tier Configs', () => {
  describe('NGN_TIER_CONFIG', () => {
    it('should have tier_1 configuration', () => {
      expect(NGN_TIER_CONFIG.tier_1).toBeDefined();
    });

    it('should have tier_2 configuration', () => {
      expect(NGN_TIER_CONFIG.tier_2).toBeDefined();
    });

    describe('tier_1', () => {
      const tier1 = NGN_TIER_CONFIG.tier_1;

      it('should have correct balance limits', () => {
        expect(tier1.minimum_balance).toBe(0);
        expect(tier1.maximum_balance).toBe(10_000_000_000_00);
      });

      it('should have correct deposit limits', () => {
        expect(tier1.minimum_per_deposit).toBe(100);
        expect(tier1.maximum_per_deposit).toBe(1_000_000_00);
        expect(tier1.maximum_daily_deposit).toBe(3_000_000_00);
        expect(tier1.maximum_weekly_deposit).toBe(5_000_000_00);
        expect(tier1.maximum_monthly_deposit).toBe(10_000_000_00);
      });

      it('should have correct transaction limits', () => {
        expect(tier1.minimum_transaction_amount).toBe(100);
        expect(tier1.maximum_transaction_amount).toBe(1_000_000_00);
        expect(tier1.maximum_daily_transaction).toBe(3_000_000_00);
        expect(tier1.maximum_weekly_transaction).toBe(5_000_000_00);
        expect(tier1.maximum_monthly_transaction).toBe(10_000_000_00);
      });

      it('should have correct withdrawal limits', () => {
        expect(tier1.minimum_per_withdrawal).toBe(100);
        expect(tier1.maximum_per_withdrawal).toBe(1_000_000_00);
        expect(tier1.maximum_daily_withdrawal).toBe(3_000_000_00);
        expect(tier1.maximum_weekly_withdrawal).toBe(5_000_000_00);
        expect(tier1.maximum_monthly_withdrawal).toBe(10_000_000_00);
      });

      it('should have correct remittance deposit limits', () => {
        expect(tier1.remittance_minimum_per_deposit).toBe(100);
        expect(tier1.remittance_maximum_per_deposit).toBe(1_000_000_00);
        expect(tier1.remittance_maximum_daily_deposit).toBe(3_000_000_00);
        expect(tier1.remittance_maximum_weekly_deposit).toBe(5_000_000_00);
        expect(tier1.remittance_maximum_monthly_deposit).toBe(10_000_000_00);
      });

      it('should have correct remittance transaction limits', () => {
        expect(tier1.remittance_minimum_transaction_amount).toBe(100);
        expect(tier1.remittance_maximum_transaction_amount).toBe(1_000_000_00);
        expect(tier1.remittance_maximum_daily_transaction).toBe(3_000_000_00);
        expect(tier1.remittance_maximum_weekly_transaction).toBe(5_000_000_00);
        expect(tier1.remittance_maximum_monthly_transaction).toBe(10_000_000_00);
      });

      it('should have correct remittance withdrawal limits', () => {
        expect(tier1.remittance_minimum_per_withdrawal).toBe(100);
        expect(tier1.remittance_maximum_per_withdrawal).toBe(1_000_000_00);
        expect(tier1.remittance_maximum_daily_withdrawal).toBe(3_000_000_00);
        expect(tier1.remittance_maximum_weekly_withdrawal).toBe(5_000_000_00);
        expect(tier1.remittance_maximum_monthly_withdrawal).toBe(10_000_000_00);
      });

      it('should have correct total limits', () => {
        expect(tier1.total_spendable).toBe(100_000_000_000_000_00);
        expect(tier1.total_receivable).toBe(10_000_000_000_00);
      });
    });

    describe('tier_2', () => {
      const tier2 = NGN_TIER_CONFIG.tier_2;

      it('should have correct balance limits', () => {
        expect(tier2.minimum_balance).toBe(0);
        expect(tier2.maximum_balance).toBe(10_000_000_000_00);
      });

      it('should have correct deposit limits', () => {
        expect(tier2.minimum_per_deposit).toBe(100);
        expect(tier2.maximum_per_deposit).toBe(2_000_000_00);
        expect(tier2.maximum_daily_deposit).toBe(5_000_000_00);
        expect(tier2.maximum_weekly_deposit).toBe(20_000_000_00);
        expect(tier2.maximum_monthly_deposit).toBe(50_000_000_00);
      });

      it('should have correct transaction limits', () => {
        expect(tier2.minimum_transaction_amount).toBe(100);
        expect(tier2.maximum_transaction_amount).toBe(2_000_000_00);
        expect(tier2.maximum_daily_transaction).toBe(5_000_000_00);
        expect(tier2.maximum_weekly_transaction).toBe(20_000_000_00);
        expect(tier2.maximum_monthly_transaction).toBe(50_000_000_00);
      });

      it('should have correct withdrawal limits', () => {
        expect(tier2.minimum_per_withdrawal).toBe(100);
        expect(tier2.maximum_per_withdrawal).toBe(2_000_000_00);
        expect(tier2.maximum_daily_withdrawal).toBe(5_000_000_00);
        expect(tier2.maximum_weekly_withdrawal).toBe(20_000_000_00);
        expect(tier2.maximum_monthly_withdrawal).toBe(50_000_000_00);
      });

      it('should have correct remittance deposit limits', () => {
        expect(tier2.remittance_minimum_per_deposit).toBe(100);
        expect(tier2.remittance_maximum_per_deposit).toBe(2_000_000_00);
        expect(tier2.remittance_maximum_daily_deposit).toBe(5_000_000_00);
        expect(tier2.remittance_maximum_weekly_deposit).toBe(20_000_000_00);
        expect(tier2.remittance_maximum_monthly_deposit).toBe(50_000_000_00);
      });

      it('should have correct remittance transaction limits', () => {
        expect(tier2.remittance_minimum_transaction_amount).toBe(100);
        expect(tier2.remittance_maximum_transaction_amount).toBe(2_000_000_00);
        expect(tier2.remittance_maximum_daily_transaction).toBe(5_000_000_00);
        expect(tier2.remittance_maximum_weekly_transaction).toBe(20_000_000_00);
        expect(tier2.remittance_maximum_monthly_transaction).toBe(50_000_000_00);
      });

      it('should have correct remittance withdrawal limits', () => {
        expect(tier2.remittance_minimum_per_withdrawal).toBe(100);
        expect(tier2.remittance_maximum_per_withdrawal).toBe(2_000_000_00);
        expect(tier2.remittance_maximum_daily_withdrawal).toBe(5_000_000_00);
        expect(tier2.remittance_maximum_weekly_withdrawal).toBe(20_000_000_00);
        expect(tier2.remittance_maximum_monthly_withdrawal).toBe(50_000_000_00);
      });

      it('should have correct total limits', () => {
        expect(tier2.total_spendable).toBe(100_000_000_000_000_00);
        expect(tier2.total_receivable).toBe(10_000_000_000_00);
      });
    });

    it('should have tier_2 limits higher than tier_1', () => {
      expect(NGN_TIER_CONFIG.tier_2.maximum_per_deposit).toBeGreaterThan(NGN_TIER_CONFIG.tier_1.maximum_per_deposit);
      expect(NGN_TIER_CONFIG.tier_2.maximum_daily_deposit).toBeGreaterThan(
        NGN_TIER_CONFIG.tier_1.maximum_daily_deposit,
      );
      expect(NGN_TIER_CONFIG.tier_2.maximum_weekly_deposit).toBeGreaterThan(
        NGN_TIER_CONFIG.tier_1.maximum_weekly_deposit,
      );
      expect(NGN_TIER_CONFIG.tier_2.maximum_monthly_deposit).toBeGreaterThan(
        NGN_TIER_CONFIG.tier_1.maximum_monthly_deposit,
      );
    });
  });

  describe('USA_TIER_CONFIG', () => {
    it('should have tier_1 configuration', () => {
      expect(USA_TIER_CONFIG.tier_1).toBeDefined();
    });

    it('should have tier_2 configuration', () => {
      expect(USA_TIER_CONFIG.tier_2).toBeDefined();
    });

    describe('tier_1', () => {
      const tier1 = USA_TIER_CONFIG.tier_1;

      it('should have correct balance limits', () => {
        expect(tier1.minimum_balance).toBe(0);
        expect(tier1.maximum_balance).toBe(20_000_00);
      });

      it('should have correct deposit limits', () => {
        expect(tier1.minimum_per_deposit).toBe(1_00);
        expect(tier1.maximum_per_deposit).toBe(2_500_00);
        expect(tier1.maximum_daily_deposit).toBe(2_500_00);
        expect(tier1.maximum_weekly_deposit).toBe(7_500_00);
        expect(tier1.maximum_monthly_deposit).toBe(20_000_00);
      });

      it('should have correct transaction limits', () => {
        expect(tier1.minimum_transaction_amount).toBe(1_00);
        expect(tier1.maximum_transaction_amount).toBe(2_500_00);
        expect(tier1.maximum_daily_transaction).toBe(2_500_00);
        expect(tier1.maximum_weekly_transaction).toBe(7_500_00);
        expect(tier1.maximum_monthly_transaction).toBe(20_000_00);
      });

      it('should have correct withdrawal limits', () => {
        expect(tier1.minimum_per_withdrawal).toBe(1_00);
        expect(tier1.maximum_per_withdrawal).toBe(2_500_00);
        expect(tier1.maximum_daily_withdrawal).toBe(2_500_00);
        expect(tier1.maximum_weekly_withdrawal).toBe(7_500_00);
        expect(tier1.maximum_monthly_withdrawal).toBe(20_000_00);
      });

      it('should have correct remittance deposit limits', () => {
        expect(tier1.remittance_minimum_per_deposit).toBe(1_00);
        expect(tier1.remittance_maximum_per_deposit).toBe(2_500_00);
        expect(tier1.remittance_maximum_daily_deposit).toBe(2_500_00);
        expect(tier1.remittance_maximum_weekly_deposit).toBe(7_500_00);
        expect(tier1.remittance_maximum_monthly_deposit).toBe(20_000_00);
      });

      it('should have correct remittance transaction limits', () => {
        expect(tier1.remittance_minimum_transaction_amount).toBe(1_00);
        expect(tier1.remittance_maximum_transaction_amount).toBe(2_500_00);
        expect(tier1.remittance_maximum_daily_transaction).toBe(2_500_00);
        expect(tier1.remittance_maximum_weekly_transaction).toBe(7_500_00);
        expect(tier1.remittance_maximum_monthly_transaction).toBe(20_000_00);
      });

      it('should have correct remittance withdrawal limits', () => {
        expect(tier1.remittance_minimum_per_withdrawal).toBe(1_00);
        expect(tier1.remittance_maximum_per_withdrawal).toBe(2_500_00);
        expect(tier1.remittance_maximum_daily_withdrawal).toBe(2_500_00);
        expect(tier1.remittance_maximum_weekly_withdrawal).toBe(7_500_00);
        expect(tier1.remittance_maximum_monthly_withdrawal).toBe(20_000_00);
      });

      it('should have correct total limits', () => {
        expect(tier1.total_spendable).toBe(10_000_000_000_000_00);
        expect(tier1.total_receivable).toBe(20_000_00);
      });
    });

    describe('tier_2', () => {
      const tier2 = USA_TIER_CONFIG.tier_2;

      it('should have correct balance limits', () => {
        expect(tier2.minimum_balance).toBe(0);
        expect(tier2.maximum_balance).toBe(20_000_00);
      });

      it('should have correct deposit limits', () => {
        expect(tier2.minimum_per_deposit).toBe(1_00);
        expect(tier2.maximum_per_deposit).toBe(2_500_00);
        expect(tier2.maximum_daily_deposit).toBe(2_500_00);
        expect(tier2.maximum_weekly_deposit).toBe(7_500_00);
        expect(tier2.maximum_monthly_deposit).toBe(20_000_00);
      });

      it('should have correct transaction limits', () => {
        expect(tier2.minimum_transaction_amount).toBe(1_00);
        expect(tier2.maximum_transaction_amount).toBe(2_500_00);
        expect(tier2.maximum_daily_transaction).toBe(2_500_00);
        expect(tier2.maximum_weekly_transaction).toBe(7_500_00);
        expect(tier2.maximum_monthly_transaction).toBe(20_000_00);
      });

      it('should have correct withdrawal limits', () => {
        expect(tier2.minimum_per_withdrawal).toBe(1_00);
        expect(tier2.maximum_per_withdrawal).toBe(2_500_00);
        expect(tier2.maximum_daily_withdrawal).toBe(2_500_00);
        expect(tier2.maximum_weekly_withdrawal).toBe(7_500_00);
        expect(tier2.maximum_monthly_withdrawal).toBe(20_000_00);
      });

      it('should have correct remittance deposit limits', () => {
        expect(tier2.remittance_minimum_per_deposit).toBe(1_00);
        expect(tier2.remittance_maximum_per_deposit).toBe(2_500_00);
        expect(tier2.remittance_maximum_daily_deposit).toBe(2_500_00);
        expect(tier2.remittance_maximum_weekly_deposit).toBe(7_500_00);
        expect(tier2.remittance_maximum_monthly_deposit).toBe(20_000_00);
      });

      it('should have correct remittance transaction limits', () => {
        expect(tier2.remittance_minimum_transaction_amount).toBe(1_00);
        expect(tier2.remittance_maximum_transaction_amount).toBe(2_500_00);
        expect(tier2.remittance_maximum_daily_transaction).toBe(2_500_00);
        expect(tier2.remittance_maximum_weekly_transaction).toBe(7_500_00);
        expect(tier2.remittance_maximum_monthly_transaction).toBe(20_000_00);
      });

      it('should have correct remittance withdrawal limits', () => {
        expect(tier2.remittance_minimum_per_withdrawal).toBe(1_00);
        expect(tier2.remittance_maximum_per_withdrawal).toBe(2_500_00);
        expect(tier2.remittance_maximum_daily_withdrawal).toBe(2_500_00);
        expect(tier2.remittance_maximum_weekly_withdrawal).toBe(7_500_00);
        expect(tier2.remittance_maximum_monthly_withdrawal).toBe(20_000_00);
      });

      it('should have correct total limits', () => {
        expect(tier2.total_spendable).toBe(10_000_000_000_000_00);
        expect(tier2.total_receivable).toBe(20_000_00);
      });
    });

    it('should have tier_1 and tier_2 with same limits', () => {
      expect(USA_TIER_CONFIG.tier_1.maximum_per_deposit).toBe(USA_TIER_CONFIG.tier_2.maximum_per_deposit);
      expect(USA_TIER_CONFIG.tier_1.maximum_daily_deposit).toBe(USA_TIER_CONFIG.tier_2.maximum_daily_deposit);
      expect(USA_TIER_CONFIG.tier_1.maximum_weekly_deposit).toBe(USA_TIER_CONFIG.tier_2.maximum_weekly_deposit);
      expect(USA_TIER_CONFIG.tier_1.maximum_monthly_deposit).toBe(USA_TIER_CONFIG.tier_2.maximum_monthly_deposit);
    });
  });

  describe('Type exports', () => {
    it('should support NGNTierLevel type', () => {
      const tier: NGNTierLevel = 'tier_1';
      expect(NGN_TIER_CONFIG[tier]).toBeDefined();
    });

    it('should support USATierLevel type', () => {
      const tier: USATierLevel = 'tier_2';
      expect(USA_TIER_CONFIG[tier]).toBeDefined();
    });

    it('should have all required properties in NGN tier config', () => {
      const tier = NGN_TIER_CONFIG.tier_1;
      const requiredProperties = [
        'minimum_balance',
        'maximum_balance',
        'minimum_per_deposit',
        'maximum_per_deposit',
        'maximum_daily_deposit',
        'maximum_weekly_deposit',
        'maximum_monthly_deposit',
        'minimum_transaction_amount',
        'maximum_transaction_amount',
        'maximum_daily_transaction',
        'maximum_weekly_transaction',
        'maximum_monthly_transaction',
        'minimum_per_withdrawal',
        'maximum_per_withdrawal',
        'maximum_daily_withdrawal',
        'maximum_weekly_withdrawal',
        'maximum_monthly_withdrawal',
        'remittance_minimum_per_deposit',
        'remittance_maximum_per_deposit',
        'remittance_maximum_daily_deposit',
        'remittance_maximum_weekly_deposit',
        'remittance_maximum_monthly_deposit',
        'remittance_minimum_transaction_amount',
        'remittance_maximum_transaction_amount',
        'remittance_maximum_daily_transaction',
        'remittance_maximum_weekly_transaction',
        'remittance_maximum_monthly_transaction',
        'remittance_minimum_per_withdrawal',
        'remittance_maximum_per_withdrawal',
        'remittance_maximum_daily_withdrawal',
        'remittance_maximum_weekly_withdrawal',
        'remittance_maximum_monthly_withdrawal',
        'total_spendable',
        'total_receivable',
      ];

      requiredProperties.forEach((prop) => {
        expect(tier).toHaveProperty(prop);
        expect(typeof tier[prop as keyof typeof tier]).toBe('number');
      });
    });

    it('should have all required properties in USA tier config', () => {
      const tier = USA_TIER_CONFIG.tier_1;
      const requiredProperties = [
        'minimum_balance',
        'maximum_balance',
        'minimum_per_deposit',
        'maximum_per_deposit',
        'maximum_daily_deposit',
        'maximum_weekly_deposit',
        'maximum_monthly_deposit',
        'minimum_transaction_amount',
        'maximum_transaction_amount',
        'maximum_daily_transaction',
        'maximum_weekly_transaction',
        'maximum_monthly_transaction',
        'minimum_per_withdrawal',
        'maximum_per_withdrawal',
        'maximum_daily_withdrawal',
        'maximum_weekly_withdrawal',
        'maximum_monthly_withdrawal',
        'remittance_minimum_per_deposit',
        'remittance_maximum_per_deposit',
        'remittance_maximum_daily_deposit',
        'remittance_maximum_weekly_deposit',
        'remittance_maximum_monthly_deposit',
        'remittance_minimum_transaction_amount',
        'remittance_maximum_transaction_amount',
        'remittance_maximum_daily_transaction',
        'remittance_maximum_weekly_transaction',
        'remittance_maximum_monthly_transaction',
        'remittance_minimum_per_withdrawal',
        'remittance_maximum_per_withdrawal',
        'remittance_maximum_daily_withdrawal',
        'remittance_maximum_weekly_withdrawal',
        'remittance_maximum_monthly_withdrawal',
        'total_spendable',
        'total_receivable',
      ];

      requiredProperties.forEach((prop) => {
        expect(tier).toHaveProperty(prop);
        expect(typeof tier[prop as keyof typeof tier]).toBe('number');
      });
    });
  });

  describe('Config validation', () => {
    it('should have minimum values less than or equal to maximum values for NGN tier_1', () => {
      const tier = NGN_TIER_CONFIG.tier_1;
      expect(tier.minimum_balance).toBeLessThanOrEqual(tier.maximum_balance);
      expect(tier.minimum_per_deposit).toBeLessThanOrEqual(tier.maximum_per_deposit);
      expect(tier.minimum_transaction_amount).toBeLessThanOrEqual(tier.maximum_transaction_amount);
      expect(tier.minimum_per_withdrawal).toBeLessThanOrEqual(tier.maximum_per_withdrawal);
    });

    it('should have minimum values less than or equal to maximum values for NGN tier_2', () => {
      const tier = NGN_TIER_CONFIG.tier_2;
      expect(tier.minimum_balance).toBeLessThanOrEqual(tier.maximum_balance);
      expect(tier.minimum_per_deposit).toBeLessThanOrEqual(tier.maximum_per_deposit);
      expect(tier.minimum_transaction_amount).toBeLessThanOrEqual(tier.maximum_transaction_amount);
      expect(tier.minimum_per_withdrawal).toBeLessThanOrEqual(tier.maximum_per_withdrawal);
    });

    it('should have minimum values less than or equal to maximum values for USA tier_1', () => {
      const tier = USA_TIER_CONFIG.tier_1;
      expect(tier.minimum_balance).toBeLessThanOrEqual(tier.maximum_balance);
      expect(tier.minimum_per_deposit).toBeLessThanOrEqual(tier.maximum_per_deposit);
      expect(tier.minimum_transaction_amount).toBeLessThanOrEqual(tier.maximum_transaction_amount);
      expect(tier.minimum_per_withdrawal).toBeLessThanOrEqual(tier.maximum_per_withdrawal);
    });

    it('should have minimum values less than or equal to maximum values for USA tier_2', () => {
      const tier = USA_TIER_CONFIG.tier_2;
      expect(tier.minimum_balance).toBeLessThanOrEqual(tier.maximum_balance);
      expect(tier.minimum_per_deposit).toBeLessThanOrEqual(tier.maximum_per_deposit);
      expect(tier.minimum_transaction_amount).toBeLessThanOrEqual(tier.maximum_transaction_amount);
      expect(tier.minimum_per_withdrawal).toBeLessThanOrEqual(tier.maximum_per_withdrawal);
    });

    it('should have daily limits less than or equal to weekly limits for NGN configs', () => {
      Object.values(NGN_TIER_CONFIG).forEach((tier) => {
        expect(tier.maximum_daily_deposit).toBeLessThanOrEqual(tier.maximum_weekly_deposit);
        expect(tier.maximum_daily_transaction).toBeLessThanOrEqual(tier.maximum_weekly_transaction);
        expect(tier.maximum_daily_withdrawal).toBeLessThanOrEqual(tier.maximum_weekly_withdrawal);
      });
    });

    it('should have weekly limits less than or equal to monthly limits for NGN configs', () => {
      Object.values(NGN_TIER_CONFIG).forEach((tier) => {
        expect(tier.maximum_weekly_deposit).toBeLessThanOrEqual(tier.maximum_monthly_deposit);
        expect(tier.maximum_weekly_transaction).toBeLessThanOrEqual(tier.maximum_monthly_transaction);
        expect(tier.maximum_weekly_withdrawal).toBeLessThanOrEqual(tier.maximum_monthly_withdrawal);
      });
    });

    it('should have daily limits less than or equal to weekly limits for USA configs', () => {
      Object.values(USA_TIER_CONFIG).forEach((tier) => {
        expect(tier.maximum_daily_deposit).toBeLessThanOrEqual(tier.maximum_weekly_deposit);
        expect(tier.maximum_daily_transaction).toBeLessThanOrEqual(tier.maximum_weekly_transaction);
        expect(tier.maximum_daily_withdrawal).toBeLessThanOrEqual(tier.maximum_weekly_withdrawal);
      });
    });

    it('should have weekly limits less than or equal to monthly limits for USA configs', () => {
      Object.values(USA_TIER_CONFIG).forEach((tier) => {
        expect(tier.maximum_weekly_deposit).toBeLessThanOrEqual(tier.maximum_monthly_deposit);
        expect(tier.maximum_weekly_transaction).toBeLessThanOrEqual(tier.maximum_monthly_transaction);
        expect(tier.maximum_weekly_withdrawal).toBeLessThanOrEqual(tier.maximum_monthly_withdrawal);
      });
    });
  });
});
