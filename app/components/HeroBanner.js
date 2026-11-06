"use client";

import Link from "next/link";
import Image from "next/image";
import { useTranslation } from "../hooks/useTranslation";

export default function HeroBanner() {
  const { t } = useTranslation();
  return (
    <section
      className="relative overflow-hidden"
      style={{ fontFamily: "var(--font-epilogue)" }}
    >
      <div className="mx-auto max-w-7xl px-4 py-10 md:py-14">
        <div className="flex flex-col gap-12 items-center">
          <div className="relative w-full max-w-[520px]">
            <Image
              src="/story.png"
              alt="Parent reading StoryPal story with child"
              className="w-full h-auto drop-shadow-xl"
              width={1040}
              height={1040}
              priority
            />
          </div>
          <div className=" text-center">
            <h1 className="leading-tight">
              <span className=" text-5xl sm:text-6xl lg:text-7xl text-[#5b217f]">
                {t("welcome")}!
              </span>
            </h1>
            <p className="mt-6 text-[#7c2da3] mx-auto text-md lg:text-xl font-semibold max-w-[700px]">
              Where every playful scene sparks imagination. Personalize stories
              using your child’s passport to reduce stress and build
              skills—joyfully.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 justify-center">
              <Link
                href="/parent"
                className="rounded-full px-6 py-3 bg-[#5b217f] text-white hover:bg-[#7c2da3] transition-colors"
              >
                Get Started
              </Link>
            </div>
          </div>
          <div className="order-1 md:order-2 flex justify-center"></div>
        </div>
      </div>
    </section>
  );
}
