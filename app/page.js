"use client";

import { useState } from "react";
import HeroBanner from "./components/HeroBanner";

export default function Home() {
  const [userName, setUserName] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [selectedScene, setSelectedScene] = useState(null);
  const [storyStep, setStoryStep] = useState(0);
  const [userResponse, setUserResponse] = useState("");
  const [selectedChoice, setSelectedChoice] = useState(null);

  const getStoryForScene = (sceneId) => {
    const stories = {
      1: [
        {
          type: "doctor",
          message: `Hey ${userName || "there"}, welcome to my clinic! I'm ${
            doctorName || "Dr. Smith"
          }, an otolaryngologist.`,
        },
        {
          type: "doctor",
          message:
            "I'm an ear, nose, and throat specialist. What brings you here today?",
        },
        {
          type: "user-input",
          message: "What made you come here?",
          placeholder: "I feel pain in my ear...",
        },
        {
          type: "doctor",
          message:
            "I understand. Let's explore this together. I have a special tool called an otoscope - it's like a tiny flashlight hero that helps me see inside your ear!",
        },
        {
          type: "doctor",
          message: "If you imagine your pain, what color would it be?",
        },
        {
          type: "choice",
          message: "Choose a color:",
          options: ["Red", "Blue", "Yellow", "Green", "Purple"],
        },
        {
          type: "doctor",
          message:
            "That's a beautiful color! Now, let's use our tiny flashlight hero to see what's going on. The light will be gentle and warm.",
        },
        {
          type: "doctor",
          message: "Can you imagine what color the light might be?",
        },
        {
          type: "choice",
          message: "What color would make you feel calm?",
          options: ["Soft blue", "Warm yellow", "Calm green", "Gentle pink"],
        },
        {
          type: "doctor",
          message:
            "Perfect! Now let's use that gentle light to explore. You're doing great!",
        },
      ],
      2: [
        {
          type: "doctor",
          message: `Hello ${userName || "there"}! I'm ${
            doctorName || "Dr. Smith"
          }, a cardiologist.`,
        },
        {
          type: "doctor",
          message: "I'm a heart specialist. What brings you to see me today?",
        },
        {
          type: "user-input",
          message: "What made you come here?",
          placeholder: "I've been feeling my heart beat fast...",
        },
        {
          type: "doctor",
          message:
            "That's important to check! I have a special tool called a stethoscope - it's like having super hearing to listen to your heartbeat.",
        },
        {
          type: "doctor",
          message:
            "Let's listen together. Your heartbeat sounds like a steady drumbeat - that means your heart is strong and healthy!",
        },
        {
          type: "doctor",
          message: "How does your heartbeat sound to you?",
        },
        {
          type: "choice",
          message: "What does it remind you of?",
          options: ["A drum", "A clock ticking", "A train chugging", "A song"],
        },
        {
          type: "doctor",
          message:
            "That's a wonderful way to think about it! Your heart is working perfectly, keeping you strong and healthy.",
        },
      ],
      3: [
        {
          type: "doctor",
          message: `Hi ${userName || "there"}! Welcome! I'm ${
            doctorName || "Dr. Smith"
          }, a pulmonologist.`,
        },
        {
          type: "doctor",
          message: "I'm a breathing specialist. What brings you here today?",
        },
        {
          type: "user-input",
          message: "What made you come here?",
          placeholder: "I've been having trouble breathing...",
        },
        {
          type: "doctor",
          message:
            "Let's help you breathe easier! I want to show you a special breathing exercise.",
        },
        {
          type: "doctor",
          message:
            "Imagine your breath as colorful bubbles. When you breathe in, beautiful bubbles float into your body. When you breathe out, they float away gently.",
        },
        {
          type: "doctor",
          message: "What color would your breathing bubbles be?",
        },
        {
          type: "choice",
          message: "Choose your bubble color:",
          options: ["Rainbow", "Blue", "Green", "Pink", "Gold"],
        },
        {
          type: "doctor",
          message:
            "Beautiful! Now let's take a calm breath together. Breathe in slowly... and breathe out gently. Just like in our story!",
        },
        {
          type: "doctor",
          message:
            "You're doing amazing! Your breathing is calm and steady now.",
        },
      ],
      4: [
        {
          type: "doctor",
          message: `Hey ${userName || "there"}! I'm ${
            doctorName || "Dr. Smith"
          }, a neurologist.`,
        },
        {
          type: "doctor",
          message:
            "I'm a brain and nervous system specialist. What brings you here?",
        },
        {
          type: "user-input",
          message: "What made you come here?",
          placeholder: "My knee feels strange when tapped...",
        },
        {
          type: "doctor",
          message:
            "I see! Let's turn this into a fun game! I'm going to check your reflexes - it's like a quick dance move your body does automatically.",
        },
        {
          type: "doctor",
          message:
            "When I tap your knee, your leg will do a little jump - that's your body being super smart and protecting you!",
        },
        {
          type: "doctor",
          message: "What do you think your reflex will look like?",
        },
        {
          type: "choice",
          message: "Choose your reflex style:",
          options: [
            "A quick hop",
            "A gentle bounce",
            "A surprise jump",
            "A playful kick",
          ],
        },
        {
          type: "doctor",
          message:
            "Perfect! Your reflexes are working great - your body is protecting you perfectly!",
        },
      ],
      5: [
        {
          type: "doctor",
          message: `Hello ${userName || "there"}! I'm ${
            doctorName || "Dr. Smith"
          }, an ophthalmologist.`,
        },
        {
          type: "doctor",
          message: "I'm an eye specialist. What brings you to see me today?",
        },
        {
          type: "user-input",
          message: "What made you come here?",
          placeholder: "I'm having trouble seeing clearly...",
        },
        {
          type: "doctor",
          message:
            "Let's make this fun! Instead of reading letters, we're going on an eye check adventure!",
        },
        {
          type: "doctor",
          message:
            "I'll show you a special chart with animals instead of letters. Can you spot the giraffe?",
        },
        {
          type: "choice",
          message: "Which animal can you see clearly?",
          options: ["Giraffe", "Rabbit", "Elephant", "Dog", "Cat", "Bird"],
        },
        {
          type: "doctor",
          message:
            "Great job! Your eyes are working well. Let's see if you can spot the next animal!",
        },
        {
          type: "choice",
          message: "What's the smallest animal you can see?",
          options: ["Dog", "Cat", "Bird", "All of them"],
        },
        {
          type: "doctor",
          message:
            "Excellent! Your eyes are exploring perfectly. You're doing great!",
        },
      ],
      6: [
        {
          type: "doctor",
          message: `Hi ${userName || "there"}! I'm ${
            doctorName || "Dr. Smith"
          }!`,
        },
        {
          type: "doctor",
          message:
            "You've been so brave today! Let's celebrate all the amazing things you did!",
        },
        {
          type: "doctor",
          message:
            "You listened to your heartbeat, practiced calm breathing, checked your reflexes, and explored with your eyes!",
        },
        {
          type: "doctor",
          message: "Which part did you like the most?",
        },
        {
          type: "choice",
          message: "What was your favorite?",
          options: [
            "The heartbeat detective",
            "The breathing bubbles",
            "The reflex game",
            "The eye adventure",
            "All of them!",
          ],
        },
        {
          type: "doctor",
          message:
            "Wonderful choice! You've earned a special reward for being so brave and cooperative!",
        },
        {
          type: "doctor",
          message: "🌟 You're a medical hero! 🌟",
        },
      ],
    };
    return stories[sceneId] || [];
  };

  const currentStory = selectedScene ? getStoryForScene(selectedScene.id) : [];
  const currentStep = currentStory[storyStep];

  const handleNext = () => {
    if (currentStep?.type === "user-input" && !userResponse.trim()) {
      return;
    }
    if (currentStep?.type === "choice" && !selectedChoice) {
      return;
    }
    if (storyStep < currentStory.length - 1) {
      setStoryStep(storyStep + 1);
      setUserResponse("");
      setSelectedChoice(null);
    } else {
      // Story complete
      setSelectedScene(null);
      setStoryStep(0);
    }
  };

  return (
    <div
      className="min-h-screen bg-background"
      style={{ fontFamily: "var(--font-shadows-into-light)" }}
    >
      <HeroBanner />
    </div>
  );
}
