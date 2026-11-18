import ParentPortal from "../../components/ParentPortal";
/** @module Child profile details entry point */
export default async function ProfilePage({ params }) {
  const { profileId } = await params;
  return <ParentPortal initialProfileId={profileId} />;
}
