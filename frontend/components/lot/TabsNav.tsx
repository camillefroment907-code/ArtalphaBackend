"use client";

export interface TabConfig {
  id: string;
  label: string;
  count?: number | null;
  disabled?: boolean;
}

interface TabsNavProps {
  tabs: TabConfig[];
  activeTab: string;
  onChange: (tabId: string) => void;
}

export function TabsNav({ tabs, activeTab, onChange }: TabsNavProps) {
  return (
    <div
      role="tablist"
      style={{
        display: "flex",
        background: "var(--white)",
        borderBottom: "1px solid var(--border)",
        paddingLeft: "32px",
        overflowX: "auto",
        msOverflowStyle: "none",
        scrollbarWidth: "none",
      }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            disabled={tab.disabled}
            onClick={() => !tab.disabled && onChange(tab.id)}
            style={{
              flexShrink: 0,
              padding: "12px 16px",
              fontSize: "13px",
              fontWeight: isActive ? 600 : 500,
              color: isActive ? "var(--navy, #1A2A44)" : "var(--text-muted, #6B7280)",
              background: "transparent",
              border: "none",
              borderBottom: isActive ? "2px solid var(--gold, #C6A85A)" : "2px solid transparent",
              marginBottom: "-1px",
              cursor: tab.disabled ? "not-allowed" : "pointer",
              opacity: tab.disabled ? 0.45 : 1,
              transition: "color 0.15s ease, border-color 0.15s ease",
              whiteSpace: "nowrap",
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
            }}
          >
            {tab.label}
            {tab.count != null && (
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--text-muted, #6B7280)",
                  fontWeight: 400,
                }}
              >
                ({tab.count})
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
