import { UserModel } from '../../database';

export interface HttpContextManagement {
  auth: HttpContextAuth;
  deviceInfo: HttpContextDeviceInfo;
}

export interface HttpContextAuth {
  user: UserModel;
}

export interface HttpContextDeviceInfo {
  deviceInfo: DeviceInfo;
  geoInfo: GeoInfo;
}

export interface SecurityContext {
  clientIp: string;
  fingerprint: string;
  deviceInfo?: DeviceInfo;
  geoInfo?: GeoInfo;
  userAgent?: string;
}

export interface DeviceInfo {
  device_name?: string;
  device_type?: string;
  os?: string;
  browser?: string;
}

export interface GeoInfo {
  city?: string | null;
  region?: string | null;
  country?: string | null;
}
