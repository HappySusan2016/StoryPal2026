import ParentPortal from "../../components/ParentPortal";

/** @module Storybook reading entry point for parents and children */
export default async function StoryPage({ params, searchParams }) {
  const { storyId } = await params;
  const { from, mode, profile } = await searchParams;

  const childMode = mode === "child";
  return (
    <ParentPortal
      key={`${storyId}:${childMode}`}
      storyReader={{
        storyId,
        childMode,
        fromProfile: from === "profile",
        bookshelfProfile: typeof profile === "string" ? profile : null,
      }}
    />
  );
}
