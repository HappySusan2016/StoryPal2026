import PortalShell from "../components/PortalShell";
import PortalAuth from "../components/PortalAuth";
/** @module Sign-in page */
export default function LoginPage() {
  return (
    <PortalShell>
      <main className="auth-wrap">
        <PortalAuth />
      </main>
    </PortalShell>
  );
}
