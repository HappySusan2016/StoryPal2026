import ParentPortal from "../../../components/ParentPortal";

/** @module Standalone storybook editing entry point */
export default async function EditStoryPage({ params, searchParams }) {
  const { storyId } = await params;
  const { from, draft } = await searchParams;

  return <ParentPortal key={storyId} storyEditor={{
    storyId,
    draftId: typeof draft === "string" ? draft : "",
    fromProfile: from === "profile",
  }} />;
}
