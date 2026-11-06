"use client";

import Image from "next/image";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPenToSquare,
  faPlus,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import { useTranslation } from "../hooks/useTranslation";

export default function SavedModules({
  modules,
  onEdit,
  onDelete,
  onCreate,
  canCreate = true,
  createDisabledReason = "",
}) {
  const { t } = useTranslation();
  return (
    <section className="mt-6">
      <h2 className="text-xl font-semibold text-zinc-900">
        {t("savedModules")}
      </h2>
      <p className="text-sm text-zinc-600">{t("modulesSavedAccount")}</p>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Create story card */}
        <button
          type="button"
          onClick={() => {
            if (!canCreate) return;
            onCreate?.();
          }}
          disabled={!canCreate || !onCreate}
          data-telemetry="parent_story_create_open"
          title={
            !canCreate && createDisabledReason
              ? createDisabledReason
              : t("createModules")
          }
          className={`rounded-2xl p-4 shadow-sm transition-shadow duration-200 bg-white/80 backdrop-blur border border-dashed border-zinc-300 text-left ${
            canCreate && onCreate
              ? "hover:shadow-md hover:border-zinc-400"
              : "opacity-60 cursor-not-allowed"
          }`}
        >
          <div className="relative w-full aspect-4/3 rounded-xl overflow-hidden mb-3 bg-zinc-50 border border-zinc-200 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2 text-zinc-700">
              <div className="w-10 h-10 rounded-full bg-[#5b217f]/10 flex items-center justify-center">
                <FontAwesomeIcon
                  icon={faPlus}
                  className="w-4 h-4 text-[#5b217f]"
                />
              </div>
              <div className="font-semibold">{t("createModules")}</div>
              <div className="text-xs text-zinc-500 text-center max-w-[240px]">
                {t("createPersonalizedStories")}
              </div>
            </div>
          </div>
          {!canCreate && createDisabledReason ? (
            <div className="text-xs text-zinc-600">{createDisabledReason}</div>
          ) : (
            <div className="text-xs text-zinc-600">{t("previewEdit")}</div>
          )}
        </button>

        {modules.map((m) => (
          <div
            key={m.id}
            className="group rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow duration-200 bg-white/80 backdrop-blur border border-zinc-200 relative"
          >
            <div className="relative w-full aspect-4/3 rounded-xl overflow-hidden mb-3 bg-zinc-100">
              {m.coverImage ? (
                <Image
                  src={m.coverImage}
                  alt={m.title}
                  fill
                  className="object-cover"
                  unoptimized
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-400 text-sm">
                  {t("noImage")}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between">
              <div className="text-zinc-900 font-semibold leading-snug">
                {m.title || t("untitledStory")}
              </div>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                <button
                  type="button"
                  onClick={() => onEdit(m)}
                  data-telemetry="parent_saved_story_edit"
                  className="rounded-full w-8 h-8 flex items-center justify-center p-2 bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                  title={t("previewEdit")}
                  aria-label={t("previewEdit")}
                >
                  <FontAwesomeIcon
                    icon={faPenToSquare}
                    className="w-3.5 h-3.5"
                  />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(m.id)}
                  data-telemetry="parent_saved_story_delete"
                  className="rounded-full w-8 h-8 flex items-center justify-center p-2 bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                  title="Delete"
                  aria-label="Delete"
                >
                  <FontAwesomeIcon icon={faTrash} className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {modules.length === 0 ? (
        <div className="mt-4 text-sm text-zinc-600">{t("noModulesYet")}</div>
      ) : null}
    </section>
  );
}
