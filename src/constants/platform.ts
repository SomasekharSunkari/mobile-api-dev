export const Platform = {
  IOS: 'ios',
  ANDROID: 'android',
} as const;

export type IPlatform = (typeof Platform)[keyof typeof Platform];
