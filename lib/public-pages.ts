// Public information only. This list never grants access to app data or APIs.
export const publicInformationPaths = ["/privacy", "/support", "/account-request"] as const;
export const supportEmail = "Josh.tiny.barnett@gmail.com";

export function isPublicInformationPath(pathname: string) {
  return publicInformationPaths.some(path => pathname === path);
}
