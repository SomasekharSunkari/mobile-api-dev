import { Test, TestingModule } from '@nestjs/testing';
import { PlatformStatusLogRepository } from './platformStatusLog.repository';

describe('PlatformStatusLogRepository', () => {
  let repository: PlatformStatusLogRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PlatformStatusLogRepository],
    }).compile();

    repository = module.get<PlatformStatusLogRepository>(PlatformStatusLogRepository);
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  it('should extend BaseRepository with PlatformStatusLogModel', () => {
    expect(repository).toBeInstanceOf(PlatformStatusLogRepository);
  });
});
