"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Zap, Flame, Star, TrendingUp, Clock, Heart,
  BarChart3, Briefcase, User, LogOut, Shield, Activity, Crown,
} from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";

const NAV_SECTIONS = [
  {
    label: "Market",
    items: [
      { href: "/dashboard",         icon: Zap,       label: "Live Feed",        },
      { href: "/hot-deals",         icon: Flame,      label: "Hot Deals",        },
      { href: "/artists/blue-chip", icon: Star,       label: "Blue Chip",        },
      { href: "/artists/emerging",  icon: TrendingUp, label: "Emerging",         },
      { href: "/missed",            icon: Clock,      label: "Missed Deals",     },
    ],
  },
  {
    label: "Portfolio",
    items: [
      { href: "/watchlist",             icon: Heart,    label: "Watchlist",         },
      { href: "/portfolio",             icon: Briefcase,label: "My Collection",     },
      { href: "/artists/analytics",     icon: BarChart3,label: "Artist Analytics",  },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/profile", icon: User, label: "Profile" },
    ],
  },
];

const ADMIN_ITEMS = [
  { href: "/admin",                   icon: Shield,   label: "Admin",       external: false },
  { href: "http://localhost:5555",    icon: Activity, label: "Job Monitor", external: true  },
];

export function Sidebar() {
  const [expanded, setExpanded] = useState(false);
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const isAdmin = user?.email === "camillefroment907@gmail.com";

  return (
    <aside
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        height: "100vh",
        width: expanded ? "220px" : "52px",
        backgroundColor: "#0a0a0b",
        borderRight: "1px solid #27272a",
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
        transition: "width 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        overflow: "hidden",
      }}
    >
      {/* Logo */}
      <div style={{
        height: "52px",
        display: "flex",
        alignItems: "center",
        padding: "0 14px",
        borderBottom: "1px solid #27272a",
        flexShrink: 0,
        gap: "10px",
      }}>
        <div style={{
          width: "24px",
          height: "24px",
          background: "linear-gradient(135deg, #d4a843, #f0c060)",
          borderRadius: "3px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}>
          <span style={{ fontSize: "12px", fontWeight: 800, color: "#09090b", fontFamily: "serif" }}>A</span>
        </div>
        {expanded && (
          <div style={{ overflow: "hidden", whiteSpace: "nowrap" }}>
            <div style={{ fontSize: "15px", fontWeight: 700, color: "#fafafa", fontFamily: "'Playfair Display', serif", letterSpacing: "0.05em" }}>
              ArtAlpha
            </div>
            <div style={{ fontSize: "9px", color: "#d4a843", letterSpacing: "0.15em", textTransform: "uppercase", marginTop: "1px" }}>
              Art Intelligence
            </div>
          </div>
        )}
      </div>

      {/* Live indicator */}
      <div style={{
        padding: expanded ? "8px 14px" : "8px",
        borderBottom: "1px solid #27272a",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        justifyContent: expanded ? "flex-start" : "center",
      }}>
        <div className="live-dot" style={{ flexShrink: 0 }} />
        {expanded && (
          <span style={{ fontSize: "10px", color: "#22c55e", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
            Scanning live
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "8px 0" }} className="no-scrollbar">
        {NAV_SECTIONS.map(section => (
          <div key={section.label}>
            {expanded && (
              <div style={{
                fontSize: "9px", fontWeight: 700, letterSpacing: "0.15em",
                textTransform: "uppercase", color: "#52525b",
                padding: "10px 14px 4px",
              }}>
                {section.label}
              </div>
            )}
            {section.items.map(item => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} style={{ textDecoration: "none" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: expanded ? "8px 14px" : "8px",
                      justifyContent: expanded ? "flex-start" : "center",
                      margin: "1px 4px",
                      borderRadius: "3px",
                      cursor: "pointer",
                      backgroundColor: active ? "rgba(212,168,67,0.1)" : "transparent",
                      borderLeft: active && expanded ? "2px solid #d4a843" : "2px solid transparent",
                      transition: "all 0.1s ease",
                    }}
                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLDivElement).style.backgroundColor = "#18181b"; }}
                    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLDivElement).style.backgroundColor = "transparent"; }}
                  >
                    <Icon size={16} style={{ color: active ? "#d4a843" : "#71717a", flexShrink: 0 }} />
                    {expanded && (
                      <span style={{ fontSize: "13px", fontWeight: 500, color: active ? "#d4a843" : "#d4d4d8", whiteSpace: "nowrap" }}>
                        {item.label}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
            {!expanded && <div style={{ height: "4px" }} />}
          </div>
        ))}

        {/* Admin — owner only */}
        {isAdmin && (
          <div>
            {expanded && (
              <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "#52525b", padding: "10px 14px 4px" }}>
                System
              </div>
            )}
            {ADMIN_ITEMS.map(item => {
              const Icon = item.icon;
              const inner = (
                <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: expanded ? "8px 14px" : "8px", justifyContent: expanded ? "flex-start" : "center", margin: "1px 4px", borderRadius: "3px", cursor: "pointer" }}>
                  <Icon size={15} style={{ color: "#52525b", flexShrink: 0 }} />
                  {expanded && <span style={{ fontSize: "13px", color: "#71717a", whiteSpace: "nowrap" }}>{item.label}</span>}
                </div>
              );
              return item.external ? (
                <a key={item.href} href={item.href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>{inner}</a>
              ) : (
                <Link key={item.href} href={item.href} style={{ textDecoration: "none" }}>{inner}</Link>
              );
            })}
          </div>
        )}
      </nav>

      {/* Upgrade banner */}
      {expanded && (!user || (user as any).plan === "free" || !(user as any).plan) && (
        <Link href="/pricing" style={{ textDecoration: "none" }}>
          <div style={{
            margin: "8px", padding: "10px",
            background: "linear-gradient(135deg, rgba(212,168,67,0.15), rgba(212,168,67,0.05))",
            border: "1px solid rgba(212,168,67,0.3)",
            borderRadius: "4px", cursor: "pointer",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
              <Crown size={13} style={{ color: "#d4a843" }} />
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#d4a843" }}>Upgrade to Investor</span>
            </div>
            <div style={{ fontSize: "10px", color: "#a07830" }}>50 deals/day · Real-time alerts</div>
          </div>
        </Link>
      )}

      {/* Language + User */}
      <div style={{ borderTop: "1px solid #27272a", padding: "8px", flexShrink: 0 }}>
        {expanded && (
          <div style={{ marginBottom: "8px" }}>
            <LanguageSwitcher />
          </div>
        )}
        <div style={{
          display: "flex", alignItems: "center",
          gap: "8px", padding: "6px",
          borderRadius: "3px", cursor: "pointer",
          justifyContent: expanded ? "flex-start" : "center",
        }}>
          <div style={{
            width: "26px", height: "26px", borderRadius: "50%",
            background: "linear-gradient(135deg, #d4a843, #a07830)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "11px", fontWeight: 700, color: "#09090b", flexShrink: 0,
          }}>
            {user?.email?.[0]?.toUpperCase() || "?"}
          </div>
          {expanded && (
            <>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "12px", fontWeight: 500, color: "#d4d4d8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user?.email?.split("@")[0] || "Collector"}
                </div>
                <div style={{ fontSize: "10px", color: "#52525b" }}>
                  {(user as any)?.plan || "Free"}
                </div>
              </div>
              <button
                onClick={() => { logout(); router.push("/auth/login"); }}
                style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", color: "#52525b" }}
              >
                <LogOut size={13} />
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
