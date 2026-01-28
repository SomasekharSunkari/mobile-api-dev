import { ExecutionContext } from '@nestjs/common';
import { AccountDeactivationStatus } from '../../../../database/models/accountDeactivationLog/accountDeactivationLog.interface';
import { AccountDeactivationLogModel } from '../../../../database/models/accountDeactivationLog/accountDeactivationLog.model';
import {
  RestrictionCategory,
  RestrictionErrorType,
  RestrictionException,
} from '../../../../exceptions/restriction_exception';
import { AccountDeactivationGuard } from './accountDeactivation.guard';

jest.mock('../../../../database/models/accountDeactivationLog/accountDeactivationLog.model');

describe('AccountDeactivationGuard', () => {
  let guard: AccountDeactivationGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new AccountDeactivationGuard();
  });

  const createMockExecutionContext = (user: any = null): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user,
        }),
      }),
    } as unknown as ExecutionContext;
  };

  describe('canActivate', () => {
    it('should return false when user is not authenticated', async () => {
      const context = createMockExecutionContext(null);

      const result = await guard.canActivate(context);

      expect(result).toBe(false);
    });

    it('should return false when user.id is missing', async () => {
      const context = createMockExecutionContext({});

      const result = await guard.canActivate(context);

      expect(result).toBe(false);
    });

    it('should return true when no active restriction record exists', async () => {
      const userId = 'user-123';
      const context = createMockExecutionContext({ id: userId });

      const mockQuery = {
        findOne: jest.fn().mockResolvedValue(null),
      };
      (AccountDeactivationLogModel.query as jest.Mock).mockReturnValue(mockQuery);

      const result = await guard.canActivate(context);

      expect(AccountDeactivationLogModel.query).toHaveBeenCalled();
      expect(mockQuery.findOne).toHaveBeenCalledWith({
        user_id: userId,
        status: AccountDeactivationStatus.DEACTIVATED,
        is_active_log: true,
      });
      expect(result).toBe(true);
    });

    it('should throw RestrictionException with USER category when user restricted their own account', async () => {
      const userId = 'user-123';
      const context = createMockExecutionContext({ id: userId });

      const mockDeactivation = {
        id: 'deactivation-id',
        user_id: userId,
        deactivated_by_user_id: userId,
        is_active_log: true,
        status: AccountDeactivationStatus.DEACTIVATED,
      };

      const mockQuery = {
        findOne: jest.fn().mockResolvedValue(mockDeactivation),
      };
      (AccountDeactivationLogModel.query as jest.Mock).mockReturnValue(mockQuery);

      try {
        await guard.canActivate(context);
        fail('Expected RestrictionException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RestrictionException);
        expect(error.type).toBe(RestrictionErrorType.ERR_USER_ACCOUNT_SELF_RESTRICTED);
        expect(error.restrictionCategory).toBe(RestrictionCategory.USER);
        expect(error.data.canSelfResolve).toBe(true);
        expect(error.data.contactSupport).toBe(false);
      }

      expect(AccountDeactivationLogModel.query).toHaveBeenCalled();
      expect(mockQuery.findOne).toHaveBeenCalledWith({
        user_id: userId,
        status: AccountDeactivationStatus.DEACTIVATED,
        is_active_log: true,
      });
    });

    it('should throw RestrictionException with COMPLIANCE category when admin restricted the account', async () => {
      const userId = 'user-123';
      const adminId = 'admin-456';
      const context = createMockExecutionContext({ id: userId });

      const mockDeactivation = {
        id: 'deactivation-id',
        user_id: userId,
        deactivated_by_user_id: adminId,
        is_active_log: true,
        status: AccountDeactivationStatus.DEACTIVATED,
      };

      const mockQuery = {
        findOne: jest.fn().mockResolvedValue(mockDeactivation),
      };
      (AccountDeactivationLogModel.query as jest.Mock).mockReturnValue(mockQuery);

      try {
        await guard.canActivate(context);
        fail('Expected RestrictionException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RestrictionException);
        expect(error.type).toBe(RestrictionErrorType.ERR_COMPLIANCE_ACCOUNT_BLOCKED);
        expect(error.restrictionCategory).toBe(RestrictionCategory.COMPLIANCE);
        expect(error.data.canSelfResolve).toBe(false);
        expect(error.data.contactSupport).toBe(true);
      }

      expect(AccountDeactivationLogModel.query).toHaveBeenCalled();
      expect(mockQuery.findOne).toHaveBeenCalledWith({
        user_id: userId,
        status: AccountDeactivationStatus.DEACTIVATED,
        is_active_log: true,
      });
    });
  });
});
