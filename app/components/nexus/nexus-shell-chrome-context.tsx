/**
 * File: nexus-shell-chrome-context.tsx
 * Description: Shares shell-level chrome controls with route headers without coupling route UI back to the shell component.
 */
import type { PropsWithChildren } from 'react';
import { createContext, useContext } from 'react';

type NexusShellChromeContextValue = {
  isDesktop: boolean;
  isSidebarOpen: boolean;
  isPrimaryRailCollapsed: boolean;
  isSecondaryRailCollapsed: boolean;
  toggleShellMenu: () => void;
  openShellMenu: () => void;
  closeShellMenu: () => void;
};

const fallbackShellChrome: NexusShellChromeContextValue = {
  isDesktop: false,
  isSidebarOpen: false,
  isPrimaryRailCollapsed: true,
  isSecondaryRailCollapsed: true,
  toggleShellMenu: () => {},
  openShellMenu: () => {},
  closeShellMenu: () => {},
};

const NexusShellChromeContext = createContext<NexusShellChromeContextValue>(
  fallbackShellChrome,
);

/**
 * Inputs: shell chrome controls plus nested route content.
 * Output: a provider for route-level Nexus chrome controls.
 */
export function NexusShellChromeProvider({
  children,
  value,
}: PropsWithChildren<{
  value: NexusShellChromeContextValue;
}>) {
  return (
    <NexusShellChromeContext.Provider value={value}>
      {children}
    </NexusShellChromeContext.Provider>
  );
}

/**
 * Inputs: none.
 * Output: current shell chrome controls for route headers.
 */
export function useNexusShellChrome(): NexusShellChromeContextValue {
  return useContext(NexusShellChromeContext);
}
