// Navbar user dropdown component for showing logged-in user in the header.

import { useState, useRef, useEffect } from "react";

const STORAGE_KEY = "cercia_auth";

interface CachedAgent {
  name: string;
  isClaimed: boolean;
}

const styles = {
  container: {
    position: "relative" as const,
    display: "inline-block",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  userButton: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.5rem 0.75rem",
    backgroundColor: "transparent",
    border: "1px solid #333",
    borderRadius: "8px",
    color: "#fff",
    fontSize: "0.875rem",
    cursor: "pointer",
    transition: "border-color 0.2s",
  },
  userButtonHover: {
    borderColor: "#e01b24",
  },
  userName: {
    color: "#e01b24",
    fontWeight: 600,
  },
  dropdownArrow: {
    color: "#888",
    fontSize: "0.75rem",
    transition: "transform 0.2s",
  },
  dropdownArrowOpen: {
    transform: "rotate(180deg)",
  },
  dropdown: {
    position: "absolute" as const,
    top: "calc(100% + 4px)",
    right: 0,
    minWidth: "160px",
    backgroundColor: "#1a1a1a",
    border: "1px solid #333",
    borderRadius: "8px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.5)",
    zIndex: 1000,
    overflow: "hidden",
  },
  dropdownItem: {
    display: "block",
    width: "100%",
    padding: "0.75rem 1rem",
    backgroundColor: "transparent",
    border: "none",
    color: "#ccc",
    fontSize: "0.875rem",
    textAlign: "left" as const,
    cursor: "pointer",
    transition: "background-color 0.2s",
  },
  dropdownItemHover: {
    backgroundColor: "#2a2a2a",
  },
  dropdownDivider: {
    height: "1px",
    backgroundColor: "#333",
    margin: "0.25rem 0",
  },
  logoutItem: {
    color: "#e01b24",
  },
};

export function NavbarUser() {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [isButtonHovered, setIsButtonHovered] = useState(false);
  const [agent, setAgent] = useState<CachedAgent | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load cached agent from storage. Falls back to API if cache is missing but apiKey exists.
  useEffect(() => {
    const loadAgent = async () => {
      try {
        const stored = await browser.storage.local.get(STORAGE_KEY);
        const data = stored[STORAGE_KEY] as
          | { apiKey?: string; cachedAgent?: CachedAgent }
          | undefined;

        // Use cached agent if available.
        if (data?.cachedAgent) {
          setAgent(data.cachedAgent);
          return;
        }

        // Fall back to API if we have an apiKey but no cache (e.g., direct navigation).
        if (data?.apiKey) {
          const response = await fetch("https://www.moltbook.com/api/v1/agents/me", {
            headers: { Authorization: `Bearer ${data.apiKey}` },
          });

          if (response.ok) {
            const result = await response.json();
            const apiAgent = result.agent || result;
            const newAgent: CachedAgent = {
              name: apiAgent.name,
              isClaimed: apiAgent.is_claimed ?? false,
            };

            // Update state and cache for future page loads.
            setAgent(newAgent);
            await browser.storage.local.set({
              [STORAGE_KEY]: { ...data, cachedAgent: newAgent },
            });
          }
        }
      } catch (error) {
        console.error("[Cercia] Failed to load navbar agent:", error);
      }
    };

    loadAgent();
  }, []);

  // Listen for storage changes to update when user logs in/out.
  useEffect(() => {
    const handleStorageChange = (
      changes: { [key: string]: { oldValue?: unknown; newValue?: unknown } },
      areaName: string,
    ) => {
      if (areaName !== "local" || !(STORAGE_KEY in changes)) {
        return;
      }

      const change = changes[STORAGE_KEY];
      const newData = change.newValue as { cachedAgent?: CachedAgent } | undefined;

      if (newData?.cachedAgent) {
        setAgent(newData.cachedAgent);
      } else {
        setAgent(null);
      }
    };

    browser.storage.onChanged.addListener(handleStorageChange);
    return () => browser.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  // Don't render if no agent.
  if (!agent) {
    return null;
  }

  const handleToggle = () => {
    setIsOpen((prev) => !prev);
  };

  const getProfileUrl = () => `/u/${encodeURIComponent(agent.name)}`;

  const handleProfileClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(false);

    const url = getProfileUrl();
    const targetWindow = window.top ?? window;

    // Handle cmd+click (Mac) or ctrl+click (Windows/Linux) for new tab.
    if (e.metaKey || e.ctrlKey) {
      targetWindow.open(url, "_blank");
      return;
    }

    // Normal click navigates in current tab.
    targetWindow.location.assign(url);
  };

  const handleProfileMiddleClick = (e: React.MouseEvent) => {
    // Middle click (button 1) opens in new tab.
    if (e.button === 1) {
      e.preventDefault();
      e.stopPropagation();
      setIsOpen(false);
      const targetWindow = window.top ?? window;
      targetWindow.open(getProfileUrl(), "_blank");
    }
  };

  const handleLogoutClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(false);
    // Clear storage. Components listening to storage changes will update automatically.
    await browser.storage.local.remove(STORAGE_KEY);
  };

  return (
    <div
      style={styles.container}
      ref={dropdownRef}
      onBlur={(e) => {
        // Close dropdown when focus leaves the container.
        if (!dropdownRef.current?.contains(e.relatedTarget as Node)) {
          setIsOpen(false);
        }
      }}
    >
      <button
        style={{
          ...styles.userButton,
          ...(isButtonHovered ? styles.userButtonHover : {}),
        }}
        onClick={handleToggle}
        onMouseEnter={() => setIsButtonHovered(true)}
        onMouseLeave={() => setIsButtonHovered(false)}
      >
        <span style={styles.userName}>{agent.name}</span>
        <span
          style={{
            ...styles.dropdownArrow,
            ...(isOpen ? styles.dropdownArrowOpen : {}),
          }}
        >
          ▼
        </span>
      </button>

      {isOpen && (
        <div style={styles.dropdown}>
          {agent.isClaimed && (
            <>
              <button
                style={{
                  ...styles.dropdownItem,
                  ...(hoveredItem === "profile" ? styles.dropdownItemHover : {}),
                }}
                onClick={handleProfileClick}
                onAuxClick={handleProfileMiddleClick}
                onMouseEnter={() => setHoveredItem("profile")}
                onMouseLeave={() => setHoveredItem(null)}
              >
                Profile
              </button>
              <div style={styles.dropdownDivider} />
            </>
          )}
          <button
            style={{
              ...styles.dropdownItem,
              ...styles.logoutItem,
              ...(hoveredItem === "logout" ? styles.dropdownItemHover : {}),
            }}
            onClick={handleLogoutClick}
            onMouseEnter={() => setHoveredItem("logout")}
            onMouseLeave={() => setHoveredItem(null)}
          >
            Log Out
          </button>
        </div>
      )}
    </div>
  );
}
