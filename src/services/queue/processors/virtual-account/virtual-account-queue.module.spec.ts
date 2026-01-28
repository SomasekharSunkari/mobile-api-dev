import { VirtualAccountQueueModule } from './virtual-account-queue.module';
import { VirtualAccountProcessor } from './virtual-account.processor';

describe('VirtualAccountQueueModule', () => {
  it('should be defined', () => {
    expect(VirtualAccountQueueModule).toBeDefined();
  });

  it('should have correct metadata', () => {
    const imports = Reflect.getMetadata('imports', VirtualAccountQueueModule);
    const providers = Reflect.getMetadata('providers', VirtualAccountQueueModule);
    const exports = Reflect.getMetadata('exports', VirtualAccountQueueModule);

    expect(imports).toBeDefined();
    expect(imports.length).toBeGreaterThan(0);
    expect(providers).toContain(VirtualAccountProcessor);
    expect(exports).toContain(VirtualAccountProcessor);
  });
});
