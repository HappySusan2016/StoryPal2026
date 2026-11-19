import ParentPortal from "../../../components/ParentPortal";

/** @module Standalone storybook editing entry point */
export default async function EditStoryPage({ params, searchParams }) {
  const { storyId } = await params;
  const { from } = await searchParams;

  return <ParentPortal key={storyId} storyEditor={{ storyId, fromProfile: from === "profile" }} />;
}
