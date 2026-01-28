import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { VerifyCodeDto } from './verifiyCode';

describe('VerifyCodeDto', () => {
  it('should be defined', () => {
    const dto = new VerifyCodeDto();
    expect(dto).toBeDefined();
  });

  describe('email transformation', () => {
    it('should transform email to lowercase and trim whitespace', async () => {
      const dto = plainToInstance(VerifyCodeDto, {
        code: '123456',
        email: '  TEST@EXAMPLE.COM  ',
      });

      expect(dto.email).toBe('test@example.com');
    });

    it('should handle undefined email gracefully', async () => {
      const dto = plainToInstance(VerifyCodeDto, {
        code: '123456',
      });

      expect(dto.email).toBeUndefined();
    });

    it('should handle null email gracefully', async () => {
      const dto = plainToInstance(VerifyCodeDto, {
        code: '123456',
        email: null,
      });

      // Transform decorator converts null to undefined via optional chaining
      expect(dto.email).toBeUndefined();
    });
  });

  describe('validation', () => {
    it('should validate successfully with code and email', async () => {
      const dto = plainToInstance(VerifyCodeDto, {
        code: '123456',
        email: 'test@example.com',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail validation when code is missing', async () => {
      const dto = plainToInstance(VerifyCodeDto, {
        email: 'test@example.com',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'code')).toBe(true);
    });

    it('should fail validation with invalid email format', async () => {
      const dto = plainToInstance(VerifyCodeDto, {
        code: '123456',
        email: 'invalid-email',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should validate email format correctly', async () => {
      const dto = plainToInstance(VerifyCodeDto, {
        code: '123456',
        email: 'valid@example.com',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail validation when code is not a string', async () => {
      const dto = plainToInstance(VerifyCodeDto, {
        code: 123456,
        email: 'test@example.com',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
