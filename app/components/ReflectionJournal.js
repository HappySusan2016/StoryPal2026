"use client";

import { useState } from "react";
import { useTranslation } from "../hooks/useTranslation";

export default function ReflectionJournal({ modules, reflections, onSave, onEdit, onDelete }) {
  const { t } = useTranslation();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    storyId: "",
    childComfort: 2,
    parentConfidence: 3,
    observations: "",
    successMoments: "",
  });

  const resetForm = () => {
    setForm({
      storyId: "",
      childComfort: 2,
      parentConfidence: 3,
      observations: "",
      successMoments: "",
    });
    setShowForm(false);
    setEditingId(null);
  };

  const handleSave = () => {
    if (!form.storyId) return;
    onSave({
      id: editingId,
      ...form,
    });
    resetForm();
  };

  const handleEdit = (reflection) => {
    setForm({
      storyId: reflection.storyId,
      childComfort: reflection.childComfort,
      parentConfidence: reflection.parentConfidence,
      observations: reflection.observations,
      successMoments: reflection.successMoments,
    });
    setEditingId(reflection.id);
    setShowForm(true);
  };

  const handleDelete = (id) => {
    onDelete(id);
    if (editingId === id) resetForm();
  };

  return (
    <section className="mt-12">
      <div className="flex flex-col justify-between mb-4">
        <h2 className="text-2xl font-semibold text-zinc-900">
          {t("reflectionJournal")}
        </h2>
        <p className="text-zinc-700">
          {t("trackProgress")}
        </p>
      </div>
      <div className="rounded-2xl bg-white/80 backdrop-blur p-5 shadow-sm">
        {showForm && (
          <div className="mb-6 rounded-xl border border-zinc-200 p-5 bg-white">
            <h3 className="text-lg font-semibold text-zinc-900 mb-4">
              {editingId ? "Edit Reflection" : "New Reflection"}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-2">
                  Which story did you practice?
                </label>
                <select
                  value={form.storyId}
                  onChange={(e) =>
                    setForm({ ...form, storyId: e.target.value })
                  }
                  className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-300/50 focus:border-blue-300 transition-all"
                >
                  <option value="">Select a story</option>
                  {modules.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-2">
                  Child's Comfort Level: {form.childComfort}/5
                </label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={form.childComfort}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      childComfort: parseInt(e.target.value),
                    })
                  }
                  className="w-full h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-[#5b217f]"
                  style={{
                    background: `linear-gradient(to right, #5b217f 0%, #5b217f ${
                      ((form.childComfort - 1) / 4) * 100
                    }%, #e4d7ff ${
                      ((form.childComfort - 1) / 4) * 100
                    }%, #e4d7ff 100%)`,
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-2">
                  Your Confidence Level: {form.parentConfidence}/5
                </label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={form.parentConfidence}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      parentConfidence: parseInt(e.target.value),
                    })
                  }
                  className="w-full h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-[#5b217f]"
                  style={{
                    background: `linear-gradient(to right, #5b217f 0%, #5b217f ${
                      ((form.parentConfidence - 1) / 4) * 100
                    }%, #e4d7ff ${
                      ((form.parentConfidence - 1) / 4) * 100
                    }%, #e4d7ff 100%)`,
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-2">
                  What did you observe?
                </label>
                <textarea
                  value={form.observations}
                  onChange={(e) =>
                    setForm({ ...form, observations: e.target.value })
                  }
                  placeholder="Describe your child's reactions, engagement, behaviors..."
                  rows={4}
                  className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-300/50 focus:border-blue-300 transition-all resize-y"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-2">
                  Success moments
                </label>
                <textarea
                  value={form.successMoments}
                  onChange={(e) =>
                    setForm({ ...form, successMoments: e.target.value })
                  }
                  placeholder="What went well? Any breakthroughs?"
                  rows={4}
                  className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-300/50 focus:border-blue-300 transition-all resize-y"
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!form.storyId}
                  className="rounded-xl px-6 py-3 bg-[#5b217f] text-white hover:bg-[#7c2da3] disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  Save Reflection
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-xl px-4 py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <ul className="mt-4 space-y-3">
          {reflections.length === 0 && (
            <li className="text-sm text-zinc-600">
              No reflections yet. Create your first reflection to track
              progress.
            </li>
          )}
          {reflections.map((reflection) => {
            const story = modules.find((m) => m.id === reflection.storyId);
            return (
              <li
                key={reflection.id}
                className="rounded-xl border border-zinc-200 p-4 bg-white"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-zinc-900 mb-2">
                      {story?.title || "Unknown Story"}
                    </div>
                    <div className="text-sm text-zinc-600 space-y-1">
                      <div>
                        Child's Comfort: {reflection.childComfort}/5
                      </div>
                      <div>
                        Your Confidence: {reflection.parentConfidence}/5
                      </div>
                      {reflection.observations && (
                        <div className="mt-2">
                          <span className="font-medium">Observations: </span>
                          {reflection.observations}
                        </div>
                      )}
                      {reflection.successMoments && (
                        <div className="mt-2">
                          <span className="font-medium">Success Moments: </span>
                          {reflection.successMoments}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-zinc-500 mt-2">
                      {new Date(reflection.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      type="button"
                      onClick={() => handleEdit(reflection)}
                      className="rounded-lg px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-sm"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(reflection.id)}
                      className="rounded-lg px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="mt-4 text-right">
          <button
            type="button"
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="rounded-xl px-4 py-2 bg-[#5b217f] text-white hover:bg-[#7c2da3] text-sm"
          >
            New Reflection
          </button>
        </div>
      </div>
    </section>
  );
}

