import { plainToInstance } from 'class-transformer';
import { IsString, validate } from 'class-validator';
import { NoSpaces, NoSpacesConstraint } from './NoSpaces';

class TestDto {
  @IsString()
  @NoSpaces({ message: 'Field cannot contain spaces' })
  field: string;
}

class TestDtoWithDefaultMessage {
  @IsString()
  @NoSpaces()
  field: string;
}

describe('NoSpacesConstraint', () => {
  let constraint: NoSpacesConstraint;

  beforeEach(() => {
    constraint = new NoSpacesConstraint();
  });

  describe('validate', () => {
    it('should return true for string without spaces', () => {
      expect(constraint.validate('hello')).toBe(true);
    });

    it('should return true for string with underscores', () => {
      expect(constraint.validate('hello_world')).toBe(true);
    });

    it('should return true for string with hyphens', () => {
      expect(constraint.validate('hello-world')).toBe(true);
    });

    it('should return false for string with single space', () => {
      expect(constraint.validate('hello world')).toBe(false);
    });

    it('should return false for string with multiple spaces', () => {
      expect(constraint.validate('hello  world  test')).toBe(false);
    });

    it('should return false for string with leading space', () => {
      expect(constraint.validate(' hello')).toBe(false);
    });

    it('should return false for string with trailing space', () => {
      expect(constraint.validate('hello ')).toBe(false);
    });

    it('should return true for non-string values (number)', () => {
      expect(constraint.validate(123)).toBe(true);
    });

    it('should return true for non-string values (null)', () => {
      expect(constraint.validate(null)).toBe(true);
    });

    it('should return true for non-string values (undefined)', () => {
      expect(constraint.validate(undefined)).toBe(true);
    });

    it('should return true for non-string values (object)', () => {
      expect(constraint.validate({ key: 'value' })).toBe(true);
    });

    it('should return true for non-string values (array)', () => {
      expect(constraint.validate(['hello', 'world'])).toBe(true);
    });

    it('should return true for empty string', () => {
      expect(constraint.validate('')).toBe(true);
    });
  });

  describe('defaultMessage', () => {
    it('should return the default error message', () => {
      expect(constraint.defaultMessage()).toBe('Field cannot contain spaces');
    });
  });
});

describe('NoSpaces decorator', () => {
  it('should validate field without spaces', async () => {
    const dto = plainToInstance(TestDto, {
      field: 'validvalue',
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail validation for field with spaces', async () => {
    const dto = plainToInstance(TestDto, {
      field: 'invalid value',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'field')).toBe(true);
  });

  it('should use custom error message when provided', async () => {
    const dto = plainToInstance(TestDto, {
      field: 'invalid value',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const fieldError = errors.find((e) => e.property === 'field');
    expect(fieldError?.constraints).toBeDefined();
    expect(Object.values(fieldError?.constraints || {})).toContain('Field cannot contain spaces');
  });

  it('should use default message when no custom message provided', async () => {
    const dto = plainToInstance(TestDtoWithDefaultMessage, {
      field: 'invalid value',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const fieldError = errors.find((e) => e.property === 'field');
    expect(fieldError?.constraints).toBeDefined();
    expect(Object.values(fieldError?.constraints || {})).toContain('Field cannot contain spaces');
  });

  it('should validate field with special characters but no spaces', async () => {
    const dto = plainToInstance(TestDto, {
      field: 'valid_value-123',
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail for field with only spaces', async () => {
    const dto = plainToInstance(TestDto, {
      field: '   ',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'field')).toBe(true);
  });

  it('should fail for field with tab characters treated as valid (only space is checked)', async () => {
    const dto = plainToInstance(TestDto, {
      field: 'valid\tvalue',
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });
});
