"use client";

import Link from "next/link";

export default function NavLinks() {
  return (
    <div className="flex items-center gap-3">
      <Link href="/" className="text-blue-600 hover:underline">
        Home
      </Link>
      <Link href="/onboarding" className="text-blue-600 hover:underline">
        Onboarding
      </Link>
      <Link href="/scenes" className="text-blue-600 hover:underline">
        Scenes
      </Link>
      <Link href="/parent" className="text-blue-600 hover:underline">
        Parent Portal
      </Link>
      <Link href="/child" className="text-blue-600 hover:underline">
        Child Portal
      </Link>
    </div>
  );
}


