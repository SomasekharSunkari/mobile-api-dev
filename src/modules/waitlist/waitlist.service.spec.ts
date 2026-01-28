import { Test, TestingModule } from '@nestjs/testing';
import { WaitlistModel } from '../../database/models/waitlist';
import {
  IWaitlistFeature,
  IWaitlistReason,
  WaitlistFeature,
  WaitlistReason,
} from '../../database/models/waitlist/waitlist.interface';
import { WaitlistRepository } from './waitlist.repository';
import { WaitlistService } from './waitlist.service';

describe('WaitlistService', () => {
  let service: WaitlistService;
  let waitlistRepository: jest.Mocked<WaitlistRepository>;

  const mockUserId = 'user-123';
  const mockUserEmail = 'user@example.com';
  const mockReason: IWaitlistReason = WaitlistReason.PHYSICAL_CARDS;
  const mockFeature: IWaitlistFeature = WaitlistFeature.CARD;

  const mockExistingWaitlist: Partial<WaitlistModel> = {
    id: 'waitlist-123',
    user_id: mockUserId,
    user_email: mockUserEmail,
    reason: mockReason,
    feature: mockFeature,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockNewWaitlist: Partial<WaitlistModel> = {
    id: 'waitlist-456',
    user_id: mockUserId,
    user_email: mockUserEmail,
    reason: mockReason,
    feature: mockFeature,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    const mockRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      findByUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WaitlistService,
        {
          provide: WaitlistRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<WaitlistService>(WaitlistService);
    waitlistRepository = module.get(WaitlistRepository) as jest.Mocked<WaitlistRepository>;

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('joinWaitlist', () => {
    it('should return existing waitlist entry when user already joined for the same reason (idempotent)', async () => {
      waitlistRepository.findOne.mockResolvedValue(mockExistingWaitlist as WaitlistModel);

      const result = await service.joinWaitlist(mockUserId, mockUserEmail, mockReason, mockFeature);

      expect(waitlistRepository.findOne).toHaveBeenCalledWith({
        user_id: mockUserId,
        feature: mockFeature,
        reason: mockReason,
      });
      expect(waitlistRepository.create).not.toHaveBeenCalled();
      expect(result).toEqual(mockExistingWaitlist);
    });

    it('should create new waitlist entry when user has not joined for the reason', async () => {
      waitlistRepository.findOne.mockResolvedValue(null);
      waitlistRepository.create.mockResolvedValue(mockNewWaitlist as WaitlistModel);

      const result = await service.joinWaitlist(mockUserId, mockUserEmail, mockReason, mockFeature);

      expect(waitlistRepository.findOne).toHaveBeenCalledWith({
        user_id: mockUserId,
        feature: mockFeature,
        reason: mockReason,
      });
      expect(waitlistRepository.create).toHaveBeenCalledWith({
        user_id: mockUserId,
        user_email: mockUserEmail,
        reason: mockReason,
        feature: mockFeature,
      });
      expect(result).toEqual(mockNewWaitlist);
    });

    it('should handle different waitlist reasons separately', async () => {
      const locationReason: IWaitlistReason = WaitlistReason.LOCATION_UNBLOCKED;

      waitlistRepository.findOne.mockResolvedValueOnce(null);
      waitlistRepository.findOne.mockResolvedValueOnce(null);
      waitlistRepository.create.mockResolvedValueOnce(mockNewWaitlist as WaitlistModel);
      waitlistRepository.create.mockResolvedValueOnce({
        ...mockNewWaitlist,
        id: 'waitlist-789',
        reason: locationReason,
        feature: WaitlistFeature.TRANSFER,
      } as WaitlistModel);

      const result1 = await service.joinWaitlist(mockUserId, mockUserEmail, mockReason, WaitlistFeature.CARD);
      const result2 = await service.joinWaitlist(mockUserId, mockUserEmail, locationReason, WaitlistFeature.TRANSFER);

      expect(waitlistRepository.create).toHaveBeenCalledTimes(2);
      expect(result1.reason).toBe(WaitlistReason.PHYSICAL_CARDS);
      expect(result2.reason).toBe(WaitlistReason.LOCATION_UNBLOCKED);
    });

    it('should log when user attempts to join waitlist', async () => {
      const logSpy = jest.spyOn(service['logger'], 'log');
      waitlistRepository.findOne.mockResolvedValue(null);
      waitlistRepository.create.mockResolvedValue(mockNewWaitlist as WaitlistModel);

      await service.joinWaitlist(mockUserId, mockUserEmail, mockReason, mockFeature);

      expect(logSpy).toHaveBeenCalledWith(
        `User ${mockUserId} attempting to join waitlist for reason: ${mockReason}, feature: ${mockFeature}`,
      );
    });

    it('should log when user already exists on waitlist', async () => {
      const logSpy = jest.spyOn(service['logger'], 'log');
      waitlistRepository.findOne.mockResolvedValue(mockExistingWaitlist as WaitlistModel);

      await service.joinWaitlist(mockUserId, mockUserEmail, mockReason, mockFeature);

      expect(logSpy).toHaveBeenCalledWith(
        `User ${mockUserId} already on waitlist for reason: ${mockReason}, feature: ${mockFeature}`,
      );
    });

    it('should log when user successfully joins waitlist', async () => {
      const logSpy = jest.spyOn(service['logger'], 'log');
      waitlistRepository.findOne.mockResolvedValue(null);
      waitlistRepository.create.mockResolvedValue(mockNewWaitlist as WaitlistModel);

      await service.joinWaitlist(mockUserId, mockUserEmail, mockReason, mockFeature);

      expect(logSpy).toHaveBeenCalledWith(
        `User ${mockUserId} successfully joined waitlist for reason: ${mockReason}, feature: ${mockFeature}`,
      );
    });

    it('should handle repository errors when finding existing entry', async () => {
      const error = new Error('Database error');
      waitlistRepository.findOne.mockRejectedValue(error);

      await expect(service.joinWaitlist(mockUserId, mockUserEmail, mockReason, mockFeature)).rejects.toThrow(
        'Database error',
      );
      expect(waitlistRepository.create).not.toHaveBeenCalled();
    });

    it('should handle repository errors when creating new entry', async () => {
      const error = new Error('Database error');
      waitlistRepository.findOne.mockResolvedValue(null);
      waitlistRepository.create.mockRejectedValue(error);

      await expect(service.joinWaitlist(mockUserId, mockUserEmail, mockReason, mockFeature)).rejects.toThrow(
        'Database error',
      );
    });
  });

  describe('getUserWaitlists', () => {
    it('should fetch waitlists for a user without filters', async () => {
      const waitlists = [mockExistingWaitlist as WaitlistModel];
      waitlistRepository.findByUser.mockResolvedValue(waitlists as WaitlistModel[]);

      const result = await service.getUserWaitlists(mockUserId);

      expect(waitlistRepository.findByUser).toHaveBeenCalledWith(mockUserId, undefined);
      expect(result).toEqual(waitlists);
    });

    it('should fetch waitlists for a user with reason and feature filters', async () => {
      const waitlists = [mockExistingWaitlist as WaitlistModel];
      waitlistRepository.findByUser.mockResolvedValue(waitlists as WaitlistModel[]);

      const result = await service.getUserWaitlists(mockUserId, {
        reason: mockReason,
        feature: mockFeature,
      });

      expect(waitlistRepository.findByUser).toHaveBeenCalledWith(mockUserId, {
        reason: mockReason,
        feature: mockFeature,
      });
      expect(result).toEqual(waitlists);
    });
  });

  describe('getWaitlistOptions', () => {
    it('should return all supported reasons and features', async () => {
      const result = await service.getWaitlistOptions();

      expect(result.reasons).toEqual(Object.values(WaitlistReason));
      expect(result.features).toEqual(Object.values(WaitlistFeature));
    });
  });
});
