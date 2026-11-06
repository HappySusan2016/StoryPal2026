"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRightFromBracket } from "@fortawesome/free-solid-svg-icons";
import { useTranslation } from "../hooks/useTranslation";

export default function SiteHeader() {
  const pathname = usePathname();
  const isParentPage =
    pathname?.startsWith("/parent") && !pathname?.includes("/auth");
  const { t } = useTranslation();

  const triggerLogout = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("request-logout"));
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur supports-[backdrop-filter]:bg-white/60 bg-white/70 border-b border-[#e8e2cf]">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
        <Link
          href="/"
          data-telemetry="nav_home_logo"
          className="flex items-center gap-2 group"
        >
          <Image
            src="/logo.png"
            alt="StoryPal Logo"
            width={36}
            height={36}
            className="w-9 h-9 object-contain"
          />
          <span className="text-2xl font-extrabold tracking-wide text-[#5b217f] group-hover:text-[#7c2da3] transition-colors">
            StoryPal
          </span>
        </Link>
        <div className="flex items-center gap-6">
          <nav className="hidden md:flex items-center gap-6 text-[#5b217f]">
            <Link
              href="/"
              data-telemetry="nav_home"
              className="hover:underline underline-offset-4"
            >
              {t("home")}
            </Link>
            <Link
              href="/parent"
              data-telemetry="nav_parent"
              className="hover:underline underline-offset-4"
            >
              {t("parent")}
            </Link>
            <Link
              href="/child"
              data-telemetry="nav_child"
              className="hover:underline underline-offset-4"
            >
              {t("child")}
            </Link>
            <Link
              href="/settings"
              data-telemetry="nav_settings"
              className="hover:underline underline-offset-4"
            >
              {t("settings")}
            </Link>
          </nav>

          <button
            type="button"
            onClick={triggerLogout}
            data-telemetry="auth_logout"
            className="text-[#5b217f] hover:text-[#967ba7] transition-colors"
            title={t("logout")}
            aria-label={t("logout")}
          >
            <FontAwesomeIcon icon={faRightFromBracket} className="w-3 h-3" />
          </button>
        </div>
      </div>
    </header>
  );
}
