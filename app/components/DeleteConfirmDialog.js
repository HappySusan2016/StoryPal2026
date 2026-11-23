"use client";

import { useId, useImperativeHandle, useRef } from "react";
import { Trash2 } from "lucide-react";
import { useTranslation } from "../hooks/useTranslation";

/** @module Deletion confirmation dialog */
export default function DeleteConfirmDialog({
  ref,
  title,
  itemName,
  description,
  confirmLabel,
  busy,
  error,
  onConfirm,
  onClose,
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);

  useImperativeHandle(ref, () => ({
    open() {
      dialogRef.current.showModal();
      // Focus Cancel by default so pressing Enter does not accidentally confirm deletion.
      cancelRef.current.focus();
    },
    close() {
      dialogRef.current?.close();
    },
  }), []);

  return (
    <dialog
      ref={dialogRef}
      className="story-delete-dialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      aria-busy={busy}
      onCancel={(event) => {
        if (busy) event.preventDefault();
      }}
      onClose={onClose}
    >
      <span className="story-delete-icon" aria-hidden="true">
        <Trash2 size={22} />
      </span>
      <h2 id={titleId}>{title}</h2>
      {itemName && <p className="story-delete-name">{itemName}</p>}
      <p id={descriptionId}>{description}</p>
      {error && <p role="alert" className="notice error">{error}</p>}
      <div className="story-delete-actions">
        <button
          ref={cancelRef}
          className="secondary"
          type="button"
          disabled={busy}
          onClick={() => dialogRef.current.close()}
        >
          {t("Cancel")}
        </button>
        <button
          className="story-delete-confirm"
          type="button"
          disabled={busy}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
