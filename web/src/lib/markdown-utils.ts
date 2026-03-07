export function extractTitle(bodyMd: string): string {
  const match = bodyMd.match(/^#\s+(.+)/m);
  return match ? match[1] : "Weekly Brief";
}
