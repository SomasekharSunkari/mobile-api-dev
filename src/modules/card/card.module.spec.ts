import { CardController } from './card.controller';
import { CardModule } from './card.module';
import { CardService } from './card.service';
import { CardRepository } from './repository/card.repository';
import { CardTransactionDisputeRepository } from './repository/cardTransactionDispute.repository';
import { CardTransactionRepository } from './repository/cardTransaction.repository';
import { CardUserRepository } from './repository/cardUser.repository';

describe('CardModule', () => {
  it('should be defined', () => {
    expect(CardModule).toBeDefined();
  });

  it('should have correct metadata', () => {
    const imports = Reflect.getMetadata('imports', CardModule);
    const controllers = Reflect.getMetadata('controllers', CardModule);
    const providers = Reflect.getMetadata('providers', CardModule);
    const exports = Reflect.getMetadata('exports', CardModule);

    expect(imports).toBeDefined();
    expect(imports.length).toBeGreaterThan(0);
    expect(controllers).toContain(CardController);
    expect(providers).toContain(CardService);
    expect(providers).toContain(CardUserRepository);
    expect(providers).toContain(CardRepository);
    expect(providers).toContain(CardTransactionRepository);
    expect(providers).toContain(CardTransactionDisputeRepository);
    expect(exports).toContain(CardService);
    expect(exports).toContain(CardUserRepository);
    expect(exports).toContain(CardRepository);
    expect(exports).toContain(CardTransactionRepository);
    expect(exports).toContain(CardTransactionDisputeRepository);
  });
});
