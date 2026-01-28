import { UserModel } from '../../../../database';

export interface MailerManager {
  subject: string;
  view: string;
  to: string | string[];
  user?: Partial<UserModel>;

  /**
   * Prepare the email data, must return a promise that resolves to a record of data
   */
  prepare(): Promise<Record<string, any>>;
}
