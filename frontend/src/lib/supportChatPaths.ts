/** Live mock-interview session — help chat must stay hidden here. */
export function isLiveInterviewPath(pathname: string): boolean {
  return /^\/interview\/[^/]+$/.test(pathname);
}
