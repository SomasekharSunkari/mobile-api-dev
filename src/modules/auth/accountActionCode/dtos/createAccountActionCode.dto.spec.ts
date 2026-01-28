import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateAccountActionDto } from './createAccountActionCode.dto';

describe('CreateAccountActionDto', () => {
  it('should be defined', () => {
    const dto = new CreateAccountActionDto();
    expect(dto).toBeDefined();
  });

  it('should validate reasons as required and array of strings', async () => {
    const dto = plainToInstance(CreateAccountActionDto, {
      reasons: ['Reason 1', 'Reason 2'],
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail validation when reasons is not provided', async () => {
    const dto = plainToInstance(CreateAccountActionDto, {});

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('reasons');
  });

  it('should fail validation when reasons is not an array', async () => {
    const dto = plainToInstance(CreateAccountActionDto, {
      reasons: 'not an array',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail validation when reasons contains non-string values', async () => {
    const dto = plainToInstance(CreateAccountActionDto, {
      reasons: [123, 456],
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should allow optional password field', async () => {
    const dto = plainToInstance(CreateAccountActionDto, {
      reasons: ['Reason 1'],
      password: '@Test123',
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.password).toBe('@Test123');
  });

  it('should allow optional refresh_token field', async () => {
    const dto = plainToInstance(CreateAccountActionDto, {
      reasons: ['Reason 1'],
      refresh_token: 'refresh_token_value',
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.refresh_token).toBe('refresh_token_value');
  });

  it('should allow optional email_verification_code field', async () => {
    const dto = plainToInstance(CreateAccountActionDto, {
      reasons: ['Reason 1'],
      email_verification_code: '123456',
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.email_verification_code).toBe('123456');
  });

  it('should validate all optional fields together', async () => {
    const dto = plainToInstance(CreateAccountActionDto, {
      reasons: ['Reason 1', 'Reason 2'],
      password: '@Test123',
      refresh_token: 'refresh_token_value',
      email_verification_code: '123456',
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });
});
