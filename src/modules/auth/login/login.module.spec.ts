import { LoginController } from './login.controller';
import { LoginModule } from './login.module';
import { LoginService } from './login.service';

describe('LoginModule', () => {
  it('should be defined', () => {
    expect(LoginModule).toBeDefined();
  });

  it('should have correct metadata', () => {
    const imports = Reflect.getMetadata('imports', LoginModule);
    const controllers = Reflect.getMetadata('controllers', LoginModule);
    const providers = Reflect.getMetadata('providers', LoginModule);
    const exports = Reflect.getMetadata('exports', LoginModule);

    expect(imports).toBeDefined();
    expect(imports.length).toBeGreaterThan(0);
    expect(controllers).toContain(LoginController);
    expect(providers).toContain(LoginService);
    expect(exports).toContain(LoginService);
  });
});
