/* Store storybook reading sessions separately under the corresponding child profile. */

import { arrayUnion, collection, doc, increment, onSnapshot, runTransaction, serverTimestamp, setDoc } from "firebase/firestore";
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
export function awardReadingStars(uid, { id, childId, moduleId }, stars) {
  const sessionRef = doc(db, "users", uid, "readingSessions", id);
  const rewardRef = doc(db, "users", uid, "childStars", childId);
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(sessionRef);
    if (snapshot.data()?.starsAwarded != null) return;

    transaction.set(sessionRef, { childId, moduleId, starsAwarded: stars }, { merge: true });
    transaction.set(rewardRef, {
      totalStars: increment(stars),
      lastUpdated: serverTimestamp(),
    }, { merge: true });
  });
}
