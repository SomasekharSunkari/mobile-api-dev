declare namespace Express {
  export interface Request {
    clientIp?: string;
    user?: {
      id: string;
      [key: string]: any;
    };
    deviceInfo?: {
      device_name?: string;
      device_type?: string;
      os?: string;
      browser?: string;
    };
    geoInfo?: {
      city?: string | null;
      region?: string | null;
      country?: string | null;
    };
  }
}
