import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AccountActionType, SendAccountActionCodeMailDto } from './sendAccountActionCodeMail.dto';

describe('SendAccountActionCodeMailDto', () => {
  it('should be defined', () => {
    const dto = new SendAccountActionCodeMailDto();
    expect(dto).toBeDefined();
  });

  it('should validate action as optional enum', async () => {
    const dto = plainToInstance(SendAccountActionCodeMailDto, {
      action: AccountActionType.DELETE,
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.action).toBe(AccountActionType.DELETE);
  });

  it('should allow empty object (action is optional)', async () => {
    const dto = plainToInstance(SendAccountActionCodeMailDto, {});

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail validation when action is not a valid enum value', async () => {
    const dto = plainToInstance(SendAccountActionCodeMailDto, {
      action: 'invalid_action',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should validate DEACTIVATE action', async () => {
    const dto = plainToInstance(SendAccountActionCodeMailDto, {
      action: AccountActionType.DEACTIVATE,
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should validate CHANGE_TRANSACTION_PIN action', async () => {
    const dto = plainToInstance(SendAccountActionCodeMailDto, {
      action: AccountActionType.CHANGE_TRANSACTION_PIN,
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should validate CHANGE_PASSWORD action', async () => {
    const dto = plainToInstance(SendAccountActionCodeMailDto, {
      action: AccountActionType.CHANGE_PASSWORD,
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should validate EMAIL_VERIFICATION action', async () => {
    const dto = plainToInstance(SendAccountActionCodeMailDto, {
      action: AccountActionType.EMAIL_VERIFICATION,
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should validate PHONE_VERIFICATION action', async () => {
    const dto = plainToInstance(SendAccountActionCodeMailDto, {
      action: AccountActionType.PHONE_VERIFICATION,
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should validate TWO_FACTOR_AUTH action', async () => {
    const dto = plainToInstance(SendAccountActionCodeMailDto, {
      action: AccountActionType.TWO_FACTOR_AUTH,
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should validate ACCOUNT_DEACTIVATION action', async () => {
    const dto = plainToInstance(SendAccountActionCodeMailDto, {
      action: AccountActionType.ACCOUNT_DEACTIVATION,
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should validate WITHDRAW_FUNDS action', async () => {
    const dto = plainToInstance(SendAccountActionCodeMailDto, {
      action: AccountActionType.WITHDRAW_FUNDS,
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should validate RESET_PASSWORD action', async () => {
    const dto = plainToInstance(SendAccountActionCodeMailDto, {
      action: AccountActionType.RESET_PASSWORD,
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should validate RESET_TRANSACTION_PIN action', async () => {
    const dto = plainToInstance(SendAccountActionCodeMailDto, {
      action: AccountActionType.RESET_TRANSACTION_PIN,
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });
});

describe('AccountActionType enum', () => {
  it('should have correct enum values', () => {
    expect(AccountActionType.DELETE).toBe('delete');
    expect(AccountActionType.DEACTIVATE).toBe('deactivate');
    expect(AccountActionType.CHANGE_TRANSACTION_PIN).toBe('change_transaction_pin');
    expect(AccountActionType.CHANGE_PASSWORD).toBe('change_password');
    expect(AccountActionType.EMAIL_VERIFICATION).toBe('email_verification');
    expect(AccountActionType.PHONE_VERIFICATION).toBe('phone_verification');
    expect(AccountActionType.TWO_FACTOR_AUTH).toBe('two_factor_auth');
    expect(AccountActionType.ACCOUNT_DEACTIVATION).toBe('account_deactivation');
    expect(AccountActionType.WITHDRAW_FUNDS).toBe('withdraw_funds');
    expect(AccountActionType.RESET_PASSWORD).toBe('reset_password');
    expect(AccountActionType.RESET_TRANSACTION_PIN).toBe('reset_transaction_pin');
  });
});
