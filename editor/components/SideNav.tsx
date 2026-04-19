'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { editorRoute } from '@/lib/editor-routes';
import { getEditorConfig } from '@/editor.config';
import type { NavItem } from '@/editor.config';
import styles from './SideNav.module.css';

export function buildDefaultNavItems(): NavItem[] {
  return [
    { href: editorRoute('/dashboard'), icon: '📊', label: '대시보드' },
    { href: editorRoute('/content/plans'), icon: '📋', label: '기획' },
    {
      href: editorRoute('/'),
      icon: '🎬',
      label: '영상',
      children: [
        { href: editorRoute('/'), icon: '📁', label: '프로젝트' },
        { href: editorRoute('/references'), icon: '🎬', label: '영상 레퍼런스' },
        { href: editorRoute('/finished'), icon: '🎞️', label: '완료 영상' },
      ],
    },
    {
      href: editorRoute('/carousel'),
      icon: '🎠',
      label: '캐러셀',
      children: [
        { href: editorRoute('/carousel'), icon: '🎠', label: '캐러셀' },
        { href: editorRoute('/carousel/templates'), icon: '🧩', label: '템플릿' },
        { href: editorRoute('/carousel/references'), icon: '📌', label: '레퍼런스' },
      ],
    },
  ];
}

export default function SideNav() {
  const pathname = usePathname();
  const config = getEditorConfig();
  const NAV_ITEMS = config.navItems ?? buildDefaultNavItems();

  const isCarouselSection = pathname.startsWith(editorRoute('/carousel'));
  const isVideoSection = pathname === editorRoute('/') || pathname.startsWith(editorRoute('/references')) || pathname.startsWith(editorRoute('/finished')) || pathname.startsWith(editorRoute('/editor')) || pathname.startsWith(editorRoute('/studio'));

  function isSectionOpen(item: NavItem): boolean {
    if (item.href === editorRoute('/carousel')) return isCarouselSection;
    if (item.href === editorRoute('/')) return isVideoSection;
    return false;
  }

  function isChildActive(child: NavItem, parent: NavItem): boolean {
    if (parent.href === editorRoute('/carousel')) {
      if (child.href === editorRoute('/carousel')) {
        const carouselPath = editorRoute('/carousel');
        return pathname === carouselPath || (pathname.startsWith(carouselPath + '/') && !pathname.startsWith(editorRoute('/carousel/templates')) && !pathname.startsWith(editorRoute('/carousel/references')));
      }
      return pathname === child.href || pathname.startsWith(child.href);
    }
    if (parent.href === editorRoute('/')) {
      if (child.href === editorRoute('/')) return pathname === editorRoute('/') || pathname.startsWith(editorRoute('/editor')) || pathname.startsWith(editorRoute('/studio'));
      return pathname.startsWith(child.href);
    }
    return pathname.startsWith(child.href);
  }

  return (
    <nav className={styles.sidenav}>
      <div className={styles.logo}>B</div>
      <div className={styles.navItems}>
        {NAV_ITEMS.map((item) => {
          if (item.children) {
            const open = isSectionOpen(item);
            return (
              <div key={item.href + item.label}>
                <Link
                  href={item.href}
                  className={`${styles.navLink} ${open ? styles.active : ''}`}
                  title={item.label}
                >
                  <span className={styles.navIcon}>{item.icon}</span>
                  <span className={styles.navLabel}>{item.label}</span>
                </Link>
                {open && (
                  <div className={styles.subItems}>
                    {item.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={`${styles.subLink} ${isChildActive(child, item) ? styles.active : ''}`}
                        title={child.label}
                      >
                        <span className={styles.navIcon}>{child.icon}</span>
                        <span className={styles.navLabel}>{child.label}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navLink} ${isActive ? styles.active : ''}`}
              title={item.label}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              <span className={styles.navLabel}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
