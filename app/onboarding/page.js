"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import NavLinks from "../components/NavLinks";

const USER_KEY = "sp.userName";
const DOCTOR_KEY = "sp.doctorName";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [userName, setUserName] = useState("");
  const [doctorName, setDoctorName] = useState("");

  function goToStep2() {
    if (userName.trim()) setStep(2);
  }

  function finish() {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(USER_KEY, userName.trim());
      window.sessionStorage.setItem(DOCTOR_KEY, doctorName.trim());
    }
    router.push("/scenes");
  }

  return (
    <div className="min-h-screen bg-background px-6 py-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-4xl font-semibold text-zinc-900">Onboarding</h1>
          <NavLinks />
        </div>

        <main className="w-full p-6 rounded-2xl bg-white/80 backdrop-blur shadow-sm">
          <div className="space-y-6">
            <p className="text-zinc-700">Let’s get to know you.</p>
            {step === 1 && (
              <>
                <div>
                  <label htmlFor="userName" className="block text-sm text-zinc-700">
                    Your name
                  </label>
                  <input
                    id="userName"
                    name="userName"
                    type="text"
                    placeholder="Your name"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && userName.trim()) {
                        goToStep2();
                      }
                    }}
                    className="mt-1 w-full bg-white/90 border border-zinc-200 rounded-xl px-4 py-3 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-rose-300/50 focus:border-rose-300 transition-all"
                  />
                </div>
                <button
                  type="button"
                  onClick={goToStep2}
                  disabled={!userName.trim()}
                  className="rounded-xl px-5 py-3 bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50"
                >
                  Next
                </button>
              </>
            )}
            {step === 2 && (
              <>
                <div>
                  <label htmlFor="doctorName" className="block text-sm text-zinc-700">
                    Doctor's name
                  </label>
                  <input
                    id="doctorName"
                    name="doctorName"
                    type="text"
                    placeholder="Doctor's name"
                    value={doctorName}
                    onChange={(e) => setDoctorName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        finish();
                      }
                    }}
                    className="mt-1 w-full bg-white/90 border border-zinc-200 rounded-xl px-4 py-3 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-rose-300/50 focus:border-rose-300 transition-all"
                  />
                </div>
                <button
                  type="button"
                  onClick={finish}
                  className="rounded-xl px-5 py-3 bg-blue-500 text-white hover:bg-blue-600"
                >
                  Save and continue
                </button>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}


