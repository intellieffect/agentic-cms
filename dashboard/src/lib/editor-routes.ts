import { getEditorConfig } from '@/lib/editor-config';

export function editorRoute(path: string): string {
  const prefix = getEditorConfig().routePrefix;
  return prefix ? `${prefix}${path}` : path;
}
