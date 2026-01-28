import { CardTransactionDisputeEventRepository } from './cardTransactionDisputeEvent.repository';
import { CardTransactionDisputeEventModel } from '../../../database/models/cardTransactionDisputeEvent/cardTransactionDisputeEvent.model';

describe('CardTransactionDisputeEventRepository', () => {
  let repository: CardTransactionDisputeEventRepository;

  beforeEach(() => {
    repository = new CardTransactionDisputeEventRepository();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  it('should use CardTransactionDisputeEventModel as its model', () => {
    expect(repository.model).toBe(CardTransactionDisputeEventModel);
  });
});
