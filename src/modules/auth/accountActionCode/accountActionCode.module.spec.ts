import { Test, TestingModule } from '@nestjs/testing';
import { AccountActionCodeController } from './accountActionCode.controller';
import { AccountActionCodeRepository } from './accountActionCode.repository';
import { AccountActionCodeService } from './accountActionCode.service';

describe('AccountActionCodeModule', () => {
  let module: TestingModule;

  const mockAccountActionCodeService = {
    createAccountActionCode: jest.fn(),
    verifyAccountActionCode: jest.fn(),
    handleSuccessfulAccountAction: jest.fn(),
  };

  const mockAccountActionCodeRepository = {
    findOne: jest.fn(),
    findSync: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    module = await Test.createTestingModule({
      controllers: [AccountActionCodeController],
      providers: [
        {
          provide: AccountActionCodeService,
          useValue: mockAccountActionCodeService,
        },
        {
          provide: AccountActionCodeRepository,
          useValue: mockAccountActionCodeRepository,
        },
      ],
    }).compile();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should provide AccountActionCodeService', () => {
    const service = module.get<AccountActionCodeService>(AccountActionCodeService);
    expect(service).toBeDefined();
  });

  it('should provide AccountActionCodeRepository', () => {
    const repository = module.get<AccountActionCodeRepository>(AccountActionCodeRepository);
    expect(repository).toBeDefined();
  });

  it('should provide AccountActionCodeController', () => {
    const controller = module.get<AccountActionCodeController>(AccountActionCodeController);
    expect(controller).toBeDefined();
  });
});
