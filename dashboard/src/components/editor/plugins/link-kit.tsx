'use client';

import { LinkPlugin } from '@platejs/link/react';

export const LinkKit = [
  LinkPlugin.configure({
    render: {
      afterEditable: () => null,
    },
  }),
];
