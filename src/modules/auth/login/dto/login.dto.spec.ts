import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LoginDto } from './login.dto';

describe('LoginDto', () => {
  it('should be defined', () => {
    const dto = new LoginDto();
    expect(dto).toBeDefined();
  });

  describe('email transformation', () => {
    it('should transform email to lowercase and trim whitespace', async () => {
      const dto = plainToInstance(LoginDto, {
        email: '  TEST@EXAMPLE.COM  ',
        password: 'password123',
      });

      expect(dto.email).toBe('test@example.com');
    });

    it('should handle undefined email gracefully', async () => {
      const dto = plainToInstance(LoginDto, {
        username: 'testuser',
        password: 'password123',
      });

      expect(dto.email).toBeUndefined();
    });

    it('should handle null email gracefully', async () => {
      const dto = plainToInstance(LoginDto, {
        email: null,
        password: 'password123',
      });

      // Transform decorator converts null to undefined via optional chaining
      expect(dto.email).toBeUndefined();
    });
  });

  describe('username transformation', () => {
    it('should transform username to lowercase and trim whitespace', async () => {
      const dto = plainToInstance(LoginDto, {
        username: '  TESTUSER  ',
        password: 'password123',
      });

      expect(dto.username).toBe('testuser');
    });

    it('should handle undefined username gracefully', async () => {
      const dto = plainToInstance(LoginDto, {
        email: 'test@example.com',
        password: 'password123',
      });

      expect(dto.username).toBeUndefined();
    });

    it('should handle null username gracefully', async () => {
      const dto = plainToInstance(LoginDto, {
        username: null,
        password: 'password123',
      });

      // Transform decorator converts null to undefined via optional chaining
      expect(dto.username).toBeUndefined();
    });
  });

  describe('validation', () => {
    it('should validate successfully with email and password', async () => {
      const dto = plainToInstance(LoginDto, {
        email: 'test@example.com',
        password: 'password123',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate successfully with username and password', async () => {
      const dto = plainToInstance(LoginDto, {
        username: 'testuser',
        password: 'password123',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate successfully with phone_number and password', async () => {
      const dto = plainToInstance(LoginDto, {
        phone_number: '+1234567890',
        password: 'password123',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail validation when password is missing', async () => {
      const dto = plainToInstance(LoginDto, {
        email: 'test@example.com',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'password')).toBe(true);
    });

    it('should fail validation when password is empty', async () => {
      const dto = plainToInstance(LoginDto, {
        email: 'test@example.com',
        password: '',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail validation with invalid email format', async () => {
      const dto = plainToInstance(LoginDto, {
        email: 'invalid-email',
        password: 'password123',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should require at least one identifier when none provided', async () => {
      const dto = plainToInstance(LoginDto, {
        password: 'password123',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
