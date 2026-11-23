/* Built-in storybook templates and per-child copies. */
export const DEFAULT_MODULES = [
  {
    id: "demo-green-mission",
    title: "The Green Mission",
    // Use a bundled image (from /public) so it works offline and doesn't depend on external URLs
    coverImage: "/green.jpg",
    fontPreset: "classic",
    childId: null,
    stageDesign: null,
    steps: [
      {
        type: "doctor",
        message:
          "Welcome to The Green Mission! Today, we're going on an adventure to help our friend the frog find its way home.",
        parentGuide: {
          title: "Story Introduction",
          description: "Set a playful, low-pressure tone.",
          coActionPrompt:
            "Practice: 'We're going to help the frog together. It's just for fun!'",
        },
      },
      {
        type: "doctor",
        message:
          "The friendly frog lives in a beautiful pond surrounded by lily pads and colorful fish. Can you imagine the pond in your mind?",
        parentGuide: {
          title: "Visualization",
          description: "Support imagination at their pace.",
          coActionPrompt:
            "Practice: 'What colors do you see? Can you draw it later?'",
        },
      },
      {
        type: "choice",
        message: "What do you think the frog needs help with?",
        options: [
          "Finding lily pads to hop on",
          "Making friends with other pond creatures",
          "Learning to swim in deeper water",
        ],
        parentGuide: {
          title: "Problem-Solving",
          description: "Encourage thinking without pressure.",
          coActionPrompt:
            "Practice: 'What do you think? All answers help the frog!'",
        },
      },
      {
        type: "user-input",
        message:
          "Let's help the frog! What would you say to encourage the frog on its journey?",
        placeholder:
          "e.g., You can do it, little frog! Take one hop at a time.",
        parentGuide: {
          title: "Encouragement Practice",
          description: "Model positive self-talk.",
          coActionPrompt:
            "Practice: 'When you encourage the frog, you're practicing encouraging yourself too!'",
        },
      },
      {
        type: "doctor",
        message:
          "Great job! The frog made it home safely thanks to your help. Remember, taking small steps is how we accomplish big things!",
        parentGuide: {
          title: "Celebration",
          description: "Reinforce the lesson learned.",
          coActionPrompt:
            "Practice: 'You helped the frog! What small step can you take today?'",
        },
      },
    ],
  },
  {
    id: "demo-calm-breathing",
    title: "Calm Breathing Mission",
    coverImage: "/calm.jpg",
    fontPreset: "classic",
    childId: null,
    stageDesign: null,
    steps: [
      {
        type: "doctor",
        message:
          "Hi {{child.name}}! Today our mission is to help your body feel calmer with three sparkle breaths.",
        parentGuide: {
          title: "Sensory Check",
          description: "Prepare for sensory input.",
          coActionPrompt: "Practice: 'If it's loud, I can wear headphones.'",
        },
      },
      {
        type: "doctor",
        message:
          "First, put one hand on your chest and one hand on your tummy. Feel them move as you breathe in and out.",
        parentGuide: {
          title: "Body Awareness",
          description: "Help your child connect with their body.",
          coActionPrompt:
            "Practice: Place your hands on your own chest and belly. Do it together and make it playful.",
        },
      },
      {
        type: "choice",
        message: "How does your body feel right now?",
        options: ["A little wiggly", "Very wiggly", "Pretty calm"],
        parentGuide: {
          title: "Emotional Check-in",
          description: "Validate all feelings as acceptable.",
          coActionPrompt:
            "Practice: 'There's no wrong answer. How does YOUR body feel right now?'",
        },
      },
      {
        type: "doctor",
        message:
          "Let's try three slow sparkle breaths together. Breathe in through your nose… and blow the sparkles out gently.",
        parentGuide: {
          title: "Co-Regulation",
          description: "Breathe together to calm the nervous system.",
          coActionPrompt:
            "Practice: Do the breathing WITH them. Your calm helps their calm.",
        },
      },
    ],
  },
  {
    id: "demo-school-wave",
    title: "Brave School Wave",
    coverImage: "/brave.jpg",
    fontPreset: "classic",
    childId: null,
    stageDesign: null,
    steps: [
      {
        type: "doctor",
        message:
          "StoryPal time! Today we practice a brave wave for when you arrive at school.",
        parentGuide: {
          title: "Social Preparation",
          description: "Practice greetings in a safe space.",
          coActionPrompt:
            "Practice: 'We can practice waving right now. Want to wave to me?'",
        },
      },
      {
        type: "doctor",
        message:
          "Imagine you are standing by the classroom door. Your teacher smiles and says your name.",
        parentGuide: {
          title: "Scenario Building",
          description: "Make the scenario feel safe and familiar.",
          coActionPrompt:
            "Practice: 'Let's pretend I'm the teacher. [Child's name], good morning!'",
        },
      },
      {
        type: "choice",
        message: "What feels like a good first step?",
        options: [
          "A tiny wave with your hand",
          "Just looking and nodding",
          "Holding your grown‑up's hand and waving together",
        ],
        parentGuide: {
          title: "Choice & Autonomy",
          description: "Honor their comfort level.",
          coActionPrompt:
            "Practice: 'Each option is brave in its own way. What feels right for you?'",
        },
      },
      {
        type: "user-input",
        message:
          "Together, choose one brave micro‑step for tomorrow morning. Type it here as your mission.",
        placeholder:
          "e.g., I will look at the teacher and lift my hand a little.",
        parentGuide: {
          title: "Goal Setting",
          description: "Create a tiny, achievable goal together.",
          coActionPrompt:
            "Practice: 'What's the smallest, easiest step we can try? That's our mission!'",
        },
      },
    ],
  },
];


/** Identify templates using the existing ID convention, including legacy storybooks and per-child copies. */
export function getDefaultStoryTemplate(story) {
  return DEFAULT_MODULES.find(template =>
    story.id === template.id || story.id === `${story.childId}-${template.id}`,
  );
}

/** Create separate storybooks for a new child. Stable IDs prevent duplicate copies on retry. */
export function createDefaultModules(childId, createdAt = new Date().toISOString()) {
  return DEFAULT_MODULES.map(story => ({
    ...structuredClone(story), id: `${childId}-${story.id}`, childId,
    createdAt, updatedAt: createdAt,
  }));
}

/** Find the default storybooks missing from the profile while preserving storybooks with legacy IDs and existing edits. */
export function getMissingDefaultModules(stories, passports, createdAt) {
  const storyIdsByChild = new Map();
  for (const story of stories) {
    if (!storyIdsByChild.has(story.childId)) storyIdsByChild.set(story.childId, new Set());
    storyIdsByChild.get(story.childId).add(story.id);
  }
  return passports.flatMap(passport => {
    const storyIds = storyIdsByChild.get(passport.id) || new Set();
    return createDefaultModules(passport.id, createdAt).filter((story, index) =>
      !storyIds.has(story.id) && !storyIds.has(DEFAULT_MODULES[index].id),
    );
  });
}
