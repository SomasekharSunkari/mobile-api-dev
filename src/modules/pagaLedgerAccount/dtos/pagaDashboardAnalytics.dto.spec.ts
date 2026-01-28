import { plainToInstance } from 'class-transformer';
import { PagaDashboardAnalyticsDto } from './pagaDashboardAnalytics.dto';

describe('PagaDashboardAnalyticsDto', () => {
  it('should be defined', () => {
    const dto = new PagaDashboardAnalyticsDto();
    expect(dto).toBeDefined();
  });

  describe('property assignment', () => {
    it('should correctly assign all properties', () => {
      const dto = plainToInstance(PagaDashboardAnalyticsDto, {
        paga_business_balance: 500000000,
        paga_business_balance_naira: 5000000,
        total_user_balances: 505000000,
        total_user_balances_naira: 5050000,
        balance_difference: -5000000,
        balance_difference_naira: -50000,
        needs_top_up: true,
        top_up_amount_required: 5000000,
        top_up_amount_required_naira: 50000,
        total_accounts: 1500,
        currency: 'NGN',
        generated_at: '2025-01-20T10:00:00.000Z',
      });

      expect(dto.paga_business_balance).toBe(500000000);
      expect(dto.paga_business_balance_naira).toBe(5000000);
      expect(dto.total_user_balances).toBe(505000000);
      expect(dto.total_user_balances_naira).toBe(5050000);
      expect(dto.balance_difference).toBe(-5000000);
      expect(dto.balance_difference_naira).toBe(-50000);
      expect(dto.needs_top_up).toBe(true);
      expect(dto.top_up_amount_required).toBe(5000000);
      expect(dto.top_up_amount_required_naira).toBe(50000);
      expect(dto.total_accounts).toBe(1500);
      expect(dto.currency).toBe('NGN');
      expect(dto.generated_at).toBe('2025-01-20T10:00:00.000Z');
    });

    it('should handle zero balances', () => {
      const dto = plainToInstance(PagaDashboardAnalyticsDto, {
        paga_business_balance: 0,
        paga_business_balance_naira: 0,
        total_user_balances: 0,
        total_user_balances_naira: 0,
        balance_difference: 0,
        balance_difference_naira: 0,
        needs_top_up: false,
        top_up_amount_required: 0,
        top_up_amount_required_naira: 0,
        total_accounts: 0,
        currency: 'NGN',
        generated_at: '2025-01-20T10:00:00.000Z',
      });

      expect(dto.paga_business_balance).toBe(0);
      expect(dto.total_user_balances).toBe(0);
      expect(dto.balance_difference).toBe(0);
      expect(dto.needs_top_up).toBe(false);
      expect(dto.top_up_amount_required).toBe(0);
      expect(dto.total_accounts).toBe(0);
    });

    it('should handle positive balance difference (no top-up needed)', () => {
      const dto = plainToInstance(PagaDashboardAnalyticsDto, {
        paga_business_balance: 1000000000,
        paga_business_balance_naira: 10000000,
        total_user_balances: 500000000,
        total_user_balances_naira: 5000000,
        balance_difference: 500000000,
        balance_difference_naira: 5000000,
        needs_top_up: false,
        top_up_amount_required: 0,
        top_up_amount_required_naira: 0,
        total_accounts: 100,
        currency: 'NGN',
        generated_at: '2025-01-20T10:00:00.000Z',
      });

      expect(dto.balance_difference).toBe(500000000);
      expect(dto.needs_top_up).toBe(false);
      expect(dto.top_up_amount_required).toBe(0);
    });

    it('should handle negative balance difference (top-up needed)', () => {
      const dto = plainToInstance(PagaDashboardAnalyticsDto, {
        paga_business_balance: 500000000,
        paga_business_balance_naira: 5000000,
        total_user_balances: 1000000000,
        total_user_balances_naira: 10000000,
        balance_difference: -500000000,
        balance_difference_naira: -5000000,
        needs_top_up: true,
        top_up_amount_required: 500000000,
        top_up_amount_required_naira: 5000000,
        total_accounts: 100,
        currency: 'NGN',
        generated_at: '2025-01-20T10:00:00.000Z',
      });

      expect(dto.balance_difference).toBe(-500000000);
      expect(dto.needs_top_up).toBe(true);
      expect(dto.top_up_amount_required).toBe(500000000);
    });
  });
});
