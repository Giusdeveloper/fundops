"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Building2, LogOut, Settings, Shield, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { UserUiContext } from "@/lib/auth/getUserUiContext";
import "./ProfileOrbitMenu.css";

interface ProfileOrbitMenuProps {
  uiContext: UserUiContext;
}

interface MenuAction {
  href?: string;
  label: string;
  icon: typeof Settings;
  onClick?: () => Promise<void>;
}

function getRoleLabel(uiContext: UserUiContext): string {
  if (uiContext.isImmentAdmin) return "Imment Admin";
  if (uiContext.isImmentOperator) return "Imment Operator";
  if (uiContext.isFounder) return "Founder";
  if (uiContext.isInvestor) return "Supporter";
  return "Profilo";
}

export default function ProfileOrbitMenu({ uiContext }: ProfileOrbitMenuProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const profileName =
    uiContext.fullName?.trim() || uiContext.email?.split("@")[0] || "Utente";
  const profileEmail = uiContext.email ?? null;
  const profileAvatarUrl = uiContext.avatarUrl ?? null;
  const profileInitials = profileName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const roleLabel = getRoleLabel(uiContext);
  const areaLabel =
    uiContext.effectiveArea === "investor" ? "Vista Supporter" : "Vista Startup";

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const actions = useMemo(() => {
    const items: MenuAction[] = [
      { href: "/account", label: "Profilo e impostazioni", icon: Settings },
      { href: "/companies", label: "Companies", icon: Building2 },
    ];

    if (uiContext.isImmentAdmin) {
      items.push({ href: "/admin", label: "Console admin", icon: Shield });
    }

    items.push({
      label: "Logout",
      icon: LogOut,
      onClick: async () => {
        try {
          const supabase = createClient();
          await supabase.auth.signOut();
        } finally {
          window.location.href = "/login";
        }
      },
    });

    return items;
  }, [uiContext.isImmentAdmin]);

  return (
    <div ref={rootRef} className={`profile-menu ${isOpen ? "is-open" : ""}`}>
      <button
        type="button"
        className={`profile-menu-trigger ${isOpen ? "is-open" : ""}`}
        aria-label="Apri menu profilo"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        {profileAvatarUrl ? (
          <img
            src={profileAvatarUrl}
            alt={`Foto profilo di ${profileName}`}
            className="profile-menu-avatar-image"
          />
        ) : (
          <span className="profile-menu-avatar-fallback" aria-hidden="true">
            {profileInitials || "UT"}
          </span>
        )}
        <span className="profile-menu-trigger-indicator" aria-hidden="true">
          <ChevronDown size={16} className={isOpen ? "is-open" : ""} />
        </span>
      </button>

      <div className={`profile-menu-popover ${isOpen ? "is-open" : ""}`} aria-hidden={!isOpen}>
        <div className="profile-menu-header">
          {profileAvatarUrl ? (
            <img
              src={profileAvatarUrl}
              alt=""
              aria-hidden="true"
              className="profile-menu-header-avatar"
            />
          ) : (
            <div className="profile-menu-header-avatar profile-menu-header-avatar-fallback" aria-hidden="true">
              {profileInitials || "UT"}
            </div>
          )}
          <div className="profile-menu-header-copy">
            <p className="profile-menu-name">{profileName}</p>
            <p className="profile-menu-role">{roleLabel}</p>
            <p className="profile-menu-area">{areaLabel}</p>
            {profileEmail ? <p className="profile-menu-email">{profileEmail}</p> : null}
          </div>
        </div>

        <div className="profile-menu-actions">
          <p className="profile-menu-section-label">Azioni account</p>
          {actions.filter((action) => action.label !== "Logout").map((action) => {
            const Icon = action.icon;

            if (action.href) {
              return (
                <Link
                  key={action.label}
                  href={action.href}
                  className="profile-menu-action"
                  onClick={() => setIsOpen(false)}
                >
                  <Icon size={16} />
                  <span>{action.label}</span>
                </Link>
              );
            }

          })}
        </div>
        <div className="profile-menu-footer">
          <p className="profile-menu-section-label">Sessione</p>
          {actions
            .filter((action) => action.label === "Logout")
            .map((action) => {
              const Icon = action.icon;

              return (
                <button
                  key={action.label}
                  type="button"
                  className="profile-menu-action profile-menu-action-danger"
                  onClick={() => void action.onClick?.()}
                >
                  <Icon size={16} />
                  <span>{action.label}</span>
                </button>
              );
            })}
        </div>
      </div>
    </div>
  );
}
