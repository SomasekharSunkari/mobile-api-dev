import { Test, TestingModule } from '@nestjs/testing';
import { AccountDeactivationRepository } from './accountDeactivation.repository';
import { AccountDeactivationService } from './accountDeactivation.service';

describe('AccountDeactivationModule', () => {
  let module: TestingModule;

  const mockAccountDeactivationRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    transaction: jest.fn(),
  };

  const mockAccountDeactivationService = {
    createAccountDeactivation: jest.fn(),
    activateAccount: jest.fn(),
  };

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [],
      providers: [
        {
          provide: AccountDeactivationService,
          useValue: mockAccountDeactivationService,
        },
        {
          provide: AccountDeactivationRepository,
          useValue: mockAccountDeactivationRepository,
        },
      ],
    }).compile();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should provide AccountDeactivationService', () => {
    const service = module.get<AccountDeactivationService>(AccountDeactivationService);
    expect(service).toBeDefined();
  });

  it('should provide AccountDeactivationRepository', () => {
    const repository = module.get<AccountDeactivationRepository>(AccountDeactivationRepository);
    expect(repository).toBeDefined();
  });
});
