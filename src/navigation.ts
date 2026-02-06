// Shared SPA navigation listener utility. Content scripts import this to react
// to client-side route changes using the Navigation API.

// The Navigation API is available in Chrome 102+ but TypeScript doesn't include
// its types by default.
declare const navigation: {
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
};

export type NavigationCallback = (url: string) => void;

// Subscribe to SPA navigation events using the Navigation API. The
// `currententrychange` event fires for pushState, replaceState, link clicks,
// and back/forward navigation. Returns an unsubscribe function.
export function onNavigate(callback: NavigationCallback): () => void {
  const handler = () => callback(window.location.href);
  navigation.addEventListener("currententrychange", handler);
  return () => navigation.removeEventListener("currententrychange", handler);
}
