import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserModel } from '../../database';
import { WaitlistFeature, WaitlistReason } from '../../database/models/waitlist/waitlist.interface';
import { WaitlistModel } from '../../database/models/waitlist/waitlist.model';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { WaitlistService } from './waitlist.service';
import { WaitlistController } from './waitlist.controller';

describe('WaitlistController', () => {
  let controller: WaitlistController;
  let waitlistService: jest.Mocked<WaitlistService>;

  const mockUser: Partial<UserModel> = {
    id: 'user-123',
    email: 'user@example.com',
    first_name: 'John',
    last_name: 'Doe',
  };

  const mockWaitlist: Partial<WaitlistModel> = {
    id: 'waitlist-123',
    user_id: mockUser.id,
    user_email: mockUser.email,
    reason: WaitlistReason.PHYSICAL_CARDS,
    feature: WaitlistFeature.CARD,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    const mockService = {
      joinWaitlist: jest.fn(),
      getUserWaitlists: jest.fn(),
      getWaitlistOptions: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WaitlistController],
      providers: [
        {
          provide: WaitlistService,
          useValue: mockService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<WaitlistController>(WaitlistController);
    waitlistService = module.get(WaitlistService) as jest.Mocked<WaitlistService>;

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('joinWaitlist', () => {
    it('should successfully join waitlist when user has email', async () => {
      const dto = { reason: WaitlistReason.PHYSICAL_CARDS, feature: WaitlistFeature.CARD };
      waitlistService.joinWaitlist.mockResolvedValue(mockWaitlist as WaitlistModel);

      const result = await controller.joinWaitlist(mockUser as UserModel, dto);

      expect(waitlistService.joinWaitlist).toHaveBeenCalledWith(
        mockUser.id,
        mockUser.email,
        WaitlistReason.PHYSICAL_CARDS,
        WaitlistFeature.CARD,
      );
      expect(result).toMatchObject({
        message: 'Successfully joined the waitlist',
        statusCode: HttpStatus.CREATED,
      });
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('data');
      expect(result.data).toHaveProperty('waitlist');
      expect(result.data.waitlist).toEqual(mockWaitlist);
    });

    it('should handle different waitlist reasons', async () => {
      const physicalCardsDto = { reason: WaitlistReason.PHYSICAL_CARDS, feature: WaitlistFeature.CARD };
      const locationUnblockedDto = { reason: WaitlistReason.LOCATION_UNBLOCKED, feature: WaitlistFeature.TRANSFER };

      waitlistService.joinWaitlist.mockResolvedValueOnce(mockWaitlist as WaitlistModel);
      waitlistService.joinWaitlist.mockResolvedValueOnce({
        ...mockWaitlist,
        reason: WaitlistReason.LOCATION_UNBLOCKED,
      } as WaitlistModel);

      const result1 = await controller.joinWaitlist(mockUser as UserModel, physicalCardsDto);
      const result2 = await controller.joinWaitlist(mockUser as UserModel, locationUnblockedDto);

      expect(waitlistService.joinWaitlist).toHaveBeenCalledTimes(2);
      expect(waitlistService.joinWaitlist).toHaveBeenNthCalledWith(
        1,
        mockUser.id,
        mockUser.email,
        WaitlistReason.PHYSICAL_CARDS,
        WaitlistFeature.CARD,
      );
      expect(waitlistService.joinWaitlist).toHaveBeenNthCalledWith(
        2,
        mockUser.id,
        mockUser.email,
        WaitlistReason.LOCATION_UNBLOCKED,
        WaitlistFeature.TRANSFER,
      );
      expect(result1.statusCode).toBe(HttpStatus.CREATED);
      expect(result2.statusCode).toBe(HttpStatus.CREATED);
    });

    it('should return existing waitlist entry when user already joined (idempotent)', async () => {
      const dto = { reason: WaitlistReason.PHYSICAL_CARDS, feature: WaitlistFeature.CARD };
      const existingWaitlist = {
        ...mockWaitlist,
        id: 'waitlist-existing',
        created_at: new Date('2024-01-01'),
      };
      waitlistService.joinWaitlist.mockResolvedValue(existingWaitlist as WaitlistModel);

      const result = await controller.joinWaitlist(mockUser as UserModel, dto);

      expect(waitlistService.joinWaitlist).toHaveBeenCalledWith(
        mockUser.id,
        mockUser.email,
        WaitlistReason.PHYSICAL_CARDS,
        WaitlistFeature.CARD,
      );
      expect(result.statusCode).toBe(HttpStatus.CREATED);
      expect(result.data.waitlist).toEqual(existingWaitlist);
    });

    it('should handle service errors', async () => {
      const dto = { reason: WaitlistReason.PHYSICAL_CARDS, feature: WaitlistFeature.CARD };
      const error = new Error('Service error');
      waitlistService.joinWaitlist.mockRejectedValue(error);

      await expect(controller.joinWaitlist(mockUser as UserModel, dto)).rejects.toThrow('Service error');
    });

    it('should call transformResponse with correct parameters', async () => {
      const transformResponseSpy = jest.spyOn(controller, 'transformResponse');
      const dto = { reason: WaitlistReason.PHYSICAL_CARDS, feature: WaitlistFeature.CARD };
      waitlistService.joinWaitlist.mockResolvedValue(mockWaitlist as WaitlistModel);

      await controller.joinWaitlist(mockUser as UserModel, dto);

      expect(transformResponseSpy).toHaveBeenCalledWith(
        'Successfully joined the waitlist',
        { waitlist: mockWaitlist },
        HttpStatus.CREATED,
      );
    });
  });

  describe('getUserWaitlists', () => {
    it('should fetch waitlists for the current user without filters', async () => {
      const waitlists = [mockWaitlist as WaitlistModel];
      waitlistService.getUserWaitlists.mockResolvedValue(waitlists as WaitlistModel[]);

      const result = await controller.getUserWaitlists(mockUser as UserModel, {});

      expect(waitlistService.getUserWaitlists).toHaveBeenCalledWith(mockUser.id, {
        reason: undefined,
        feature: undefined,
      });
      expect(result).toMatchObject({
        message: 'Successfully fetched user waitlists',
        statusCode: HttpStatus.OK,
      });
      expect(result.data.waitlists).toEqual(waitlists);
    });

    it('should fetch waitlists for the current user with filters', async () => {
      const waitlists = [mockWaitlist as WaitlistModel];
      waitlistService.getUserWaitlists.mockResolvedValue(waitlists as WaitlistModel[]);

      const result = await controller.getUserWaitlists(
        mockUser as UserModel,
        {
          reason: WaitlistReason.PHYSICAL_CARDS,
          feature: WaitlistFeature.CARD,
        } as any,
      );

      expect(waitlistService.getUserWaitlists).toHaveBeenCalledWith(mockUser.id, {
        reason: WaitlistReason.PHYSICAL_CARDS,
        feature: WaitlistFeature.CARD,
      });
      expect(result.data.waitlists).toEqual(waitlists);
    });
  });

  describe('getWaitlistOptions', () => {
    it('should fetch supported waitlist options', async () => {
      const options = {
        reasons: [WaitlistReason.PHYSICAL_CARDS],
        features: [WaitlistFeature.CARD],
      };
      waitlistService.getWaitlistOptions.mockResolvedValue(options);

      const result = await controller.getWaitlistOptions();

      expect(waitlistService.getWaitlistOptions).toHaveBeenCalled();
      expect(result).toMatchObject({
        message: 'Successfully fetched waitlist options',
        statusCode: HttpStatus.OK,
      });
      expect(result.data).toEqual(options);
    });
  });
});
