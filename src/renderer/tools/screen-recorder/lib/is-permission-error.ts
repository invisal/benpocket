// Catches a permission revoked/denied between the pre-flight check and the actual native-helper request.
export function isPermissionError(message: string): boolean {
  return /permission/i.test(message);
}
