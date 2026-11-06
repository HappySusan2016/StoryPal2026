import { Epilogue, Slackey, Shadows_Into_Light } from "next/font/google";
import "./globals.css";
import SiteHeader from "./components/SiteHeader";
import FontController from "./components/FontController";
import LanguageController from "./components/LanguageController";
import TelemetryProvider from "./components/TelemetryProvider";
import { config } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css";
config.autoAddCss = false;

const epilogue = Epilogue({
  variable: "--font-epilogue",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

const shadows = Shadows_Into_Light({
  variable: "--font-shadows-into-light",
  subsets: ["latin"],
  weight: "400",
});

const slackey = Slackey({
  variable: "--font-slackey",
  subsets: ["latin"],
  weight: "400",
});

export const metadata = {
  title: "Story Pal",
  description: "A friendly place to begin your story.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${epilogue.variable} ${shadows.variable} ${slackey.variable} antialiased`}
        suppressHydrationWarning
      >
        <FontController />
        <LanguageController />
        <TelemetryProvider />
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
