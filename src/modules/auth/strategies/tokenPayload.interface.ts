import { JwtPayload } from 'jsonwebtoken';
import { IUser } from '../../../database/models/user';

export type TokenPayload = Pick<IUser, 'phone_number' | 'id' | 'email' | 'username'> &
  JwtPayload & { signature?: string; identity: string };
export interface JwtData extends JwtPayload {
  email: string;
  phone_number: string;
  id: string;
  username: string;
  identity: string;
}
