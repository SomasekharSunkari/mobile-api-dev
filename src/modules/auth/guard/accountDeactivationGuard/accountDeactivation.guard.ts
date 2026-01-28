import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AccountDeactivationStatus } from '../../../../database/models/accountDeactivationLog/accountDeactivationLog.interface';
import { AccountDeactivationLogModel } from '../../../../database/models/accountDeactivationLog/accountDeactivationLog.model';
import { RestrictionErrorType, RestrictionException } from '../../../../exceptions/restriction_exception';

@Injectable()
export class AccountDeactivationGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;

    if (!userId) {
      return false;
    }

    const deactivation = await AccountDeactivationLogModel.query().findOne({
      user_id: userId,
      status: AccountDeactivationStatus.DEACTIVATED,
      is_active_log: true,
    });

    // If account is restricted, deny access with appropriate message
    if (deactivation?.is_active_log) {
      // Check if the user restricted their own account
      if (deactivation.deactivated_by_user_id === userId) {
        throw new RestrictionException(RestrictionErrorType.ERR_USER_ACCOUNT_SELF_RESTRICTED);
      }

      // Account was restricted by admin (compliance)
      throw new RestrictionException(RestrictionErrorType.ERR_COMPLIANCE_ACCOUNT_BLOCKED);
    }

    return true;
  }
}
