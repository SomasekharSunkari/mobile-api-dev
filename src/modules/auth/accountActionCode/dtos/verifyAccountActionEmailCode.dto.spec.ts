import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { VerifyAccountActionEmailCodeDto } from './verifyAccountActionEmailCode.dto';

describe('VerifyAccountActionEmailCodeDto', () => {
  it('should be defined', () => {
    const dto = new VerifyAccountActionEmailCodeDto();
    expect(dto).toBeDefined();
  });

  it('should validate code as optional string', async () => {
    const dto = plainToInstance(VerifyAccountActionEmailCodeDto, {
      code: '123456',
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.code).toBe('123456');
  });

  it('should allow empty object (code is optional)', async () => {
    const dto = plainToInstance(VerifyAccountActionEmailCodeDto, {});

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail validation when code is not a string', async () => {
    const dto = plainToInstance(VerifyAccountActionEmailCodeDto, {
      code: 123456,
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
