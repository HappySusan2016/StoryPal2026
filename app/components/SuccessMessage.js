import { CircleCheck } from "lucide-react";
import styles from "./SuccessMessage.module.css";

/** @module Shared success message */
export default function SuccessMessage({ message }) {
  return (
    <div role="status">
      {message && (
        <div className={styles.message}>
          <CircleCheck className="success-message-icon" size={18} aria-hidden="true" />
          {message}
        </div>
      )}
    </div>
  );
}
