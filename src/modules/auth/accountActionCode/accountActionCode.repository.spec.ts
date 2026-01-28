import { AccountActionCodeModel } from '../../../database/models/accountActionCode/accountActionCode.model';
import { AccountActionCodeRepository } from './accountActionCode.repository';

describe('AccountActionCodeRepository', () => {
  let repository: AccountActionCodeRepository;

  beforeEach(() => {
    repository = new AccountActionCodeRepository();
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  it('should have AccountActionCodeModel as the model', () => {
    expect(repository.model).toBe(AccountActionCodeModel);
  });

  it('should extend BaseRepository', () => {
    expect(repository).toHaveProperty('create');
    expect(repository).toHaveProperty('findOne');
    expect(repository).toHaveProperty('findSync');
    expect(repository).toHaveProperty('update');
    expect(repository).toHaveProperty('delete');
  });
});
