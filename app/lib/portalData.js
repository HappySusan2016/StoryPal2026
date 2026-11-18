/* Portal data compatibility preserves legacy storybook and passport structures. */
/** Identify built-in examples for display filtering while preserving their cloud records. */
export function isBuiltInStory(story) {
  return [
    "demo-green-mission",
    "demo-calm-breathing",
    "demo-school-wave",
  ].includes(story.id);
}
/** Accept Firestore timestamps, cached timestamp objects, and ISO dates. */
export function toMillis(value) {
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  const time = typeof value === "number" ? value : Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

/** Update basic fields shown in the reference UI while preserving undisplayed fields from legacy passports. */
export function updatePassportDetails(existing, details) {
  return {
    ...existing,
    id: existing?.id || details.id,
    childName: details.childName,
    age: details.age,
    color: details.color ?? existing?.color ?? "",
    interaction: { ...existing?.interaction, interests: details.interests },
  };
}

/** Remove the profile link while preserving all storybook content and links to other profiles. */
export function detachProfileFromStories(stories, profileId) {
  return stories.map((story) =>
    story.childId === profileId ? { ...story, childId: null } : story,
  );
}

/** Show only storybooks linked to valid profiles. Keep public examples and records with missing or invalid links in the source data. */
export function getProfileStories(stories, passports) {
  const profileIds = new Set(passports.map(passport => passport.id));
  return stories.filter(story => Boolean(story.childId) && profileIds.has(story.childId));
}
