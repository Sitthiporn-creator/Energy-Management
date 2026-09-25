"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const menuItems = [
  {
    href: "/",
    label: "Dashboard",
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
        <path d="M12 3l9 8h-3v9h-5v-6H11v6H6v-9H3l9-8z" />
      </svg>
    ),
  },
  {
    href: "/energy-data",
    label: "Energy Data",
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 3" />
      </svg>
    ),
  },
  {
    href: "/statistics",
    label: "Statistics",
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
        <rect x="4" y="12" width="4" height="8" rx="1" />
        <rect x="10" y="7" width="4" height="13" rx="1" />
        <rect x="16" y="3" width="4" height="17" rx="1" />
      </svg>
    ),
  },
  {
    href: "/generator",
    label: "Generator",
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="7" width="18" height="12" rx="2" />
        <path d="M7 7V5a2 2 0 012-2h6a2 2 0 012 2v2" />
        <path d="M8 12h3l-1 3h3l-3 4" />
      </svg>
    ),
  },
  {
    href: "/electricity",
    label: "Electricity",
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
        <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" />
      </svg>
    ),
  },
];

const styles = {
  sidebar: {
    width: 250,
    minHeight: "100vh",
    background: "linear-gradient(180deg, #0f172a 0%, #101c3a 100%)",
    padding: "22px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 26,
    boxSizing: "border-box",
    flexShrink: 0,
  },
  logoRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "0 6px",
  },
  logoIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    background: "linear-gradient(135deg, #3b82f6, #6366f1)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 20,
    flexShrink: 0,
  },
  logoTitle: {
    margin: 0,
    fontSize: 15,
    fontWeight: 700,
    color: "#ffffff",
    lineHeight: 1.3,
  },
  logoSubtitle: {
    margin: 0,
    fontSize: 12,
    color: "#94a3b8",
    lineHeight: 1.3,
  },
  menu: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  menuItemBase: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "11px 14px",
    borderRadius: 12,
    textDecoration: "none",
    fontSize: 14,
    fontWeight: 500,
  },
};

export default function Sidebar() {
  const pathname = usePathname();
  const [hovered, setHovered] = useState(null);

  return (
    <aside style={styles.sidebar}>
      <div style={styles.logoRow}>
        <div style={styles.logoIcon}>⚡</div>
        <div>
          <p style={styles.logoTitle}>Factory Energy</p>
          <p style={styles.logoSubtitle}>Management System</p>
        </div>
      </div>

      <nav style={styles.menu}>
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          const isHovered = hovered === item.href;

          const itemStyle = {
            ...styles.menuItemBase,
            color: isActive ? "#ffffff" : "#cbd5e1",
            background: isActive
              ? "linear-gradient(135deg, #2563eb, #3b82f6)"
              : isHovered
              ? "rgba(255, 255, 255, 0.06)"
              : "transparent",
            fontWeight: isActive ? 600 : 500,
            boxShadow: isActive ? "0 6px 16px rgba(37, 99, 235, 0.35)" : "none",
          };

          return (
            <Link
              key={item.href}
              href={item.href}
              style={itemStyle}
              onMouseEnter={() => setHovered(item.href)}
              onMouseLeave={() => setHovered(null)}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
