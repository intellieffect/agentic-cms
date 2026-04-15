/**
 * Resolve image URL from /uploads/ prefix to full Supabase Storage URL.
 * @param src - Image source path (may start with /uploads/)
 * @param storageBaseUrl - e.g. "https://xxx.supabase.co/storage/v1/object/public/blog-images"
 */
export function resolveImageUrl(src: string, storageBaseUrl: string): string {
  if (!src) return "";
  if (src.startsWith("/uploads/")) {
    const filename = src.replace("/uploads/", "");
    const timestamp = filename.split("-")[0];
    const date = new Date(parseInt(timestamp));
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${storageBaseUrl}/${year}/${month}/${filename}`;
  }
  return src;
}
