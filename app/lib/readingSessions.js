/* Store storybook reading sessions separately under the corresponding child profile. */

import { arrayUnion, collection, doc, onSnapshot, runTransaction, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebaseClient";

/** Merge confirmed pages atomically so writing the same page twice does not increase the count. */
export function saveReadingPage(uid, session, pageIndex, completed) {
  const { id, childId, moduleId } = session;
  return setDoc(doc(db, "users", uid, "readingSessions", id), {
    childId,
    moduleId,
    confirmedPages: arrayUnion(pageIndex),
    // Only the final page marks the session complete. Later writes preserve that status.
    ...(completed ? { completed: true } : {}),
  }, { merge: true });
}

/** Subscribe to the account's reading page counts and aggregate them by profile for the dashboard. */
export function subscribeToReadingPageCounts(uid, onCounts, onError) {
  return onSnapshot(collection(db, "users", uid, "readingSessions"), (snapshot) => {
    const counts = new Map();
    snapshot.forEach((session) => {
      const { childId, confirmedPages } = session.data();
      if (childId && Array.isArray(confirmedPages)) {
        counts.set(childId, (counts.get(childId) || 0) + confirmedPages.length);
      }
    });
    onCounts(counts);
  }, onError);
}


/** Award stars once per storybook. A transaction protects the total against concurrent claims. */
export function awardReadingStars(uid, childId, moduleId, stars) {
  const rewardRef = doc(db, "users", uid, "childStars", childId);
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(rewardRef);
    const reward = snapshot.data();
    const completedModules = reward?.completedModules || {};
    if (Object.hasOwn(completedModules, moduleId)) return;

    transaction.set(rewardRef, {
      totalStars: (reward?.totalStars || 0) + stars,
      completedModules: {
        ...completedModules,
        [moduleId]: { completedAt: serverTimestamp(), starsAwarded: stars },
      },
      lastUpdated: serverTimestamp(),
    }, { merge: true });
  });
}
