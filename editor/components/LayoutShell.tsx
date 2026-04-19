'use client';

import { usePathname } from 'next/navigation';
import SideNav from './SideNav';
import { ErrorSuppressor } from './ErrorSuppressor';

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isRender = pathname.includes('/render');

  if (isRender) {
    return <>{children}</>;
  }

  return (
    <div className="brxce-editor" style={{ display: 'flex', flexDirection: 'row', height: '100vh', overflow: 'hidden' }}>
      <ErrorSuppressor />
      <SideNav />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}
