import { Fragment } from "react";
import Link from "next/link";

/** @module Inline formatting for reference translations */
export default function PortalText({ text }) {
  // Render only the formatting and two policy links used by the reference dictionary without injecting HTML.
  return text
    .split(
      /(<a href="\/(?:terms|privacy)">.*?<\/a>|<em(?: class="accent")?>.*?<\/em>|<b>.*?<\/b>|<br\s*\/?>)/s,
    )
    .map((part, index) => {
      if (/^<br\s*\/?>$/.test(part)) return <br key={index} />;
      const emphasis = part.match(/^<em(?: class="(accent)")?>(.*?)<\/em>$/s);
      if (emphasis)
        return (
          <em key={index} className={emphasis[1]}>
            {emphasis[2]}
          </em>
        );
      const bold = part.match(/^<b>(.*?)<\/b>$/s);
      if (bold) return <b key={index}>{bold[1]}</b>;
      const link = part.match(/^<a href="(\/(?:terms|privacy))">(.*?)<\/a>$/s);
      if (link)
        return (
          <Link key={index} href={link[1]}>
            {link[2]}
          </Link>
        );
      return <Fragment key={index}>{part}</Fragment>;
    });
}
