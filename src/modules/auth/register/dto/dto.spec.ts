import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CheckEmailDto } from './checkEmailExist.dto';
import { CheckUsernameExistDto } from './checkUsernameExist.dto';
import { RegisterDto } from './register.dto';
import { RegisterCheckDto } from './registerCheck.dto';
import { AccountVerificationDto } from './sendVerificationCode.dto';

describe('CheckEmailDto', () => {
  it('should validate a valid email', async () => {
    const dto = plainToInstance(CheckEmailDto, {
      email: 'test@example.com',
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should transform email to lowercase and trim', async () => {
    const dto = plainToInstance(CheckEmailDto, {
      email: '  TEST@EXAMPLE.COM  ',
    });

    expect(dto.email).toBe('test@example.com');
  });

  it('should fail when email is invalid', async () => {
    const dto = plainToInstance(CheckEmailDto, {
      email: 'invalid-email',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('should fail when email is empty', async () => {
    const dto = plainToInstance(CheckEmailDto, {
      email: '',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('should fail when email is missing', async () => {
    const dto = plainToInstance(CheckEmailDto, {});

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });
});

describe('CheckUsernameExistDto', () => {
  it('should validate a valid username', async () => {
    const dto = plainToInstance(CheckUsernameExistDto, {
      username: 'johndoe',
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should transform username to lowercase and trim', async () => {
    const dto = plainToInstance(CheckUsernameExistDto, {
      username: '  JOHNDOE  ',
    });

    expect(dto.username).toBe('johndoe');
  });

  it('should fail when username contains spaces', async () => {
    const dto = plainToInstance(CheckUsernameExistDto, {
      username: 'john doe',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'username')).toBe(true);
  });

  it('should validate username without spaces', async () => {
    const dto = plainToInstance(CheckUsernameExistDto, {
      username: 'john_doe',
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });
});

describe('RegisterDto', () => {
  const validRegisterDto = {
    email: 'test@example.com',
    username: 'testuser',
    password: 'Password123!',
    confirm_password: 'Password123!',
    first_name: 'John',
    last_name: 'Doe',
    country_id: 'usa',
    verification_token: 'token123',
  };

  it('should validate a valid registration DTO', async () => {
    const dto = plainToInstance(RegisterDto, validRegisterDto);

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should transform email to lowercase and trim', async () => {
    const dto = plainToInstance(RegisterDto, {
      ...validRegisterDto,
      email: '  TEST@EXAMPLE.COM  ',
    });

    expect(dto.email).toBe('test@example.com');
  });

  it('should transform username to lowercase and trim', async () => {
    const dto = plainToInstance(RegisterDto, {
      ...validRegisterDto,
      username: '  TESTUSER  ',
    });

    expect(dto.username).toBe('testuser');
  });

  it('should fail when username contains spaces', async () => {
    const dto = plainToInstance(RegisterDto, {
      ...validRegisterDto,
      username: 'test user',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'username')).toBe(true);
  });

  it('should fail when email is invalid', async () => {
    const dto = plainToInstance(RegisterDto, {
      ...validRegisterDto,
      email: 'invalid-email',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('should fail when password is weak', async () => {
    const dto = plainToInstance(RegisterDto, {
      ...validRegisterDto,
      password: 'weak',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('should fail when confirm_password does not match password', async () => {
    const dto = plainToInstance(RegisterDto, {
      ...validRegisterDto,
      confirm_password: 'DifferentPassword123!',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'confirm_password')).toBe(true);
  });

  it('should fail when username is empty', async () => {
    const dto = plainToInstance(RegisterDto, {
      ...validRegisterDto,
      username: '',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'username')).toBe(true);
  });

  it('should fail when country_id is empty', async () => {
    const dto = plainToInstance(RegisterDto, {
      ...validRegisterDto,
      country_id: '',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'country_id')).toBe(true);
  });

  it('should fail when verification_token is empty', async () => {
    const dto = plainToInstance(RegisterDto, {
      ...validRegisterDto,
      verification_token: '',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'verification_token')).toBe(true);
  });

  it('should validate with optional fields', async () => {
    const dto = plainToInstance(RegisterDto, {
      email: 'test@example.com',
      username: 'testuser',
      password: 'Password123!',
      country_id: 'usa',
      verification_token: 'token123',
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should validate with phone number', async () => {
    const dto = plainToInstance(RegisterDto, {
      ...validRegisterDto,
      phone_number: '1234567890',
      phone_number_country_code: 'NG',
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail with invalid phone_number_country_code', async () => {
    const dto = plainToInstance(RegisterDto, {
      ...validRegisterDto,
      phone_number: '1234567890',
      phone_number_country_code: 'INVALID',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'phone_number_country_code')).toBe(true);
  });

  it('should validate with middle_name', async () => {
    const dto = plainToInstance(RegisterDto, {
      ...validRegisterDto,
      middle_name: 'Anthony',
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });
});

describe('RegisterCheckDto', () => {
  it('should validate a valid registration check DTO', async () => {
    const dto = plainToInstance(RegisterCheckDto, {
      email: 'test@example.com',
      phone_number: '1234567890',
      phone_number_country_code: 'NG',
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should transform email to lowercase and trim', async () => {
    const dto = plainToInstance(RegisterCheckDto, {
      email: '  TEST@EXAMPLE.COM  ',
      phone_number: '1234567890',
    });

    expect(dto.email).toBe('test@example.com');
  });

  it('should fail when email is invalid', async () => {
    const dto = plainToInstance(RegisterCheckDto, {
      email: 'invalid-email',
      phone_number: '1234567890',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('should fail when phone_number is empty', async () => {
    const dto = plainToInstance(RegisterCheckDto, {
      email: 'test@example.com',
      phone_number: '',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'phone_number')).toBe(true);
  });

  it('should fail with invalid phone_number_country_code', async () => {
    const dto = plainToInstance(RegisterCheckDto, {
      email: 'test@example.com',
      phone_number: '1234567890',
      phone_number_country_code: 'INVALID',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'phone_number_country_code')).toBe(true);
  });

  it('should validate with valid ISO country code', async () => {
    const dto = plainToInstance(RegisterCheckDto, {
      email: 'test@example.com',
      phone_number: '1234567890',
      phone_number_country_code: 'US',
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });
});

describe('AccountVerificationDto', () => {
  it('should validate a valid email', async () => {
    const dto = plainToInstance(AccountVerificationDto, {
      email: 'test@example.com',
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should transform email to lowercase and trim', async () => {
    const dto = plainToInstance(AccountVerificationDto, {
      email: '  TEST@EXAMPLE.COM  ',
    });

    expect(dto.email).toBe('test@example.com');
  });

  it('should fail when email is invalid', async () => {
    const dto = plainToInstance(AccountVerificationDto, {
      email: 'invalid-email',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('should fail when email is empty', async () => {
    const dto = plainToInstance(AccountVerificationDto, {
      email: '',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('should fail when email is missing', async () => {
    const dto = plainToInstance(AccountVerificationDto, {});

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });
});
