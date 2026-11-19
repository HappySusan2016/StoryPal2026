import ParentPortal from "../../components/ParentPortal";

/** @module Standalone storybook creation entry point */
export default async function NewStoryPage({ searchParams }) {
  const { child, draft, from } = await searchParams;
  return (
    <ParentPortal
      key={JSON.stringify([child, draft])}
      storyEditor={{
        childId: typeof child === "string" ? child : "",
        draftId: typeof draft === "string" ? draft : "",
        fromProfile: from === "profile",
      }}
    />
  );
}
