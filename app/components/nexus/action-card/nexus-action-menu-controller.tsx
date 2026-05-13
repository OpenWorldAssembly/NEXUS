/**
 * File: nexus-action-menu-controller.tsx
 * Description: Coordinates one open Nexus action menu across reusable card/list menu clusters.
 */
import type { PropsWithChildren } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform, View } from 'react-native';

import { NexusActionMenu } from './nexus-action-menu';
import type { NexusActionMenuItem } from './nexus-card-types';

type NexusActionMenuAnchorRect = {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
};

type NexusOpenActionMenu = {
  actions: NexusActionMenuItem[];
  align: 'top' | 'bottom';
  anchorRect: NexusActionMenuAnchorRect | null;
  className?: string;
  id: string;
};

type NexusActionMenuControllerValue = {
  closeMenu: () => void;
  openMenu: (menu: NexusOpenActionMenu) => void;
  openMenuId: string | null;
};

const NexusActionMenuControllerContext = createContext<NexusActionMenuControllerValue | null>(null);

function getFloatingMenuStyle(menu: NexusOpenActionMenu) {
  if (Platform.OS !== 'web' || !menu.anchorRect) {
    return undefined;
  }

  const menuWidth = 190;
  const gutter = 8;
  const viewportWidth = typeof window === 'undefined' ? 0 : window.innerWidth;
  const viewportHeight = typeof window === 'undefined' ? 0 : window.innerHeight;
  const left = Math.max(
    gutter,
    Math.min(menu.anchorRect.right - menuWidth, Math.max(gutter, viewportWidth - menuWidth - gutter)),
  );
  const shouldOpenUp =
    menu.align === 'bottom' || menu.anchorRect.bottom + 260 > viewportHeight;

  return {
    position: 'fixed',
    left,
    top: shouldOpenUp ? undefined : menu.anchorRect.bottom + gutter,
    bottom: shouldOpenUp ? Math.max(gutter, viewportHeight - menu.anchorRect.top + gutter) : undefined,
    zIndex: 10000,
  } as never;
}

/**
 * Inputs: nested Nexus UI that may render packet/card action menus.
 * Output: a shared open-menu controller plus one top-level floating menu.
 */
export function NexusActionMenuControllerProvider({ children }: PropsWithChildren) {
  const [openActionMenu, setOpenActionMenu] = useState<NexusOpenActionMenu | null>(null);

  const closeMenu = useCallback(() => {
    setOpenActionMenu(null);
  }, []);

  const openMenu = useCallback((menu: NexusOpenActionMenu) => {
    setOpenActionMenu(menu);
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || !openActionMenu || typeof document === 'undefined') {
      return;
    }

    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target;

      if (
        target instanceof Element &&
        target.closest('[data-nexus-action-menu-root="true"]')
      ) {
        return;
      }

      closeMenu();
    };

    document.addEventListener('click', handleDocumentClick);

    return () => {
      document.removeEventListener('click', handleDocumentClick);
    };
  }, [closeMenu, openActionMenu]);

  const value = useMemo(
    () => ({ closeMenu, openMenu, openMenuId: openActionMenu?.id ?? null }),
    [closeMenu, openActionMenu?.id, openMenu],
  );

  return (
    <NexusActionMenuControllerContext.Provider value={value}>
      {children}
      {openActionMenu ? (
        <View
          {...({ dataSet: { nexusActionMenuRoot: 'true' } } as never)}
          className="z-[10000]"
          style={getFloatingMenuStyle(openActionMenu)}
        >
          <NexusActionMenu
            actions={openActionMenu.actions}
            align={openActionMenu.align}
            className={openActionMenu.className}
            isFloating
            isOpen
            onClose={closeMenu}
          />
        </View>
      ) : null}
    </NexusActionMenuControllerContext.Provider>
  );
}

/**
 * Inputs: none.
 * Output: the nearest shared action-menu controller, or a local fallback for isolated renders/tests.
 */
export function useNexusActionMenuController(): NexusActionMenuControllerValue {
  const context = useContext(NexusActionMenuControllerContext);
  const [fallbackOpenMenu, setFallbackOpenMenu] = useState<NexusOpenActionMenu | null>(null);

  const fallbackCloseMenu = useCallback(() => {
    setFallbackOpenMenu(null);
  }, []);

  const fallbackOpenMenuHandler = useCallback((menu: NexusOpenActionMenu) => {
    setFallbackOpenMenu(menu);
  }, []);

  const fallbackValue = useMemo(
    () => ({
      closeMenu: fallbackCloseMenu,
      openMenu: fallbackOpenMenuHandler,
      openMenuId: fallbackOpenMenu?.id ?? null,
    }),
    [fallbackCloseMenu, fallbackOpenMenu?.id, fallbackOpenMenuHandler],
  );

  return context ?? fallbackValue;
}
