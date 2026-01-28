import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { VerifyPasswordDto } from './verifyPassword.dto';

describe('VerifyPasswordDto', () => {
  it('should be defined', () => {
    const dto = new VerifyPasswordDto();
    expect(dto).toBeDefined();
  });

  it('should validate password as required string', async () => {
    const dto = plainToInstance(VerifyPasswordDto, {
      password: '@Test123',
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.password).toBe('@Test123');
  });

  it('should fail validation when password is not provided', async () => {
    const dto = plainToInstance(VerifyPasswordDto, {});

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('password');
  });

  it('should fail validation when password is empty string', async () => {
    const dto = plainToInstance(VerifyPasswordDto, {
      password: '',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail validation when password is not a string', async () => {
    const dto = plainToInstance(VerifyPasswordDto, {
      password: 12345,
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
