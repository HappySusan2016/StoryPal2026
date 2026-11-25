/* StoryPal prompt templates use the scenarios and suggested goals from the team's Word document. */

export const storyFocuses = [
  {
    "label": "Greeting / Saying hello",
    "guidance": "Show one clear way to greet someone that matches $COMMUNICATION_MODES, and that any greeting (wave, word, sign, device) counts."
  },
  {
    "label": "Sharing / Turn-taking",
    "guidance": "Show waiting for a turn, saying or showing \"my turn\" / \"your turn\", and that waiting can feel hard and that is okay."
  },
  {
    "label": "Morning routine",
    "guidance": "Show the steps in a fixed order with \"first… then…\" language, so the child knows what comes next."
  },
  {
    "label": "Transitions: between activities",
    "guidance": "Give a warning before the change, name what is ending and what comes next, and show one calming strategy for the switch."
  },
  {
    "label": "Managing sensory surprises",
    "guidance": "Describe a sudden sight, sound or touch that may happen (never one listed in $SENSORY_SENSITIVITIES or $SENSORY_TRIGGERS), and show using $CALMING_STRATEGIES or $SAFE_WORD."
  }
];

export const storyTones = [
  {
    "label": "Encouraging & brave",
    "guidance": "Celebrate small steps of courage; use words like \"try\", \"brave\", \"I did it\"."
  },
  {
    "label": "Encouraging & supportive",
    "guidance": "Emphasise that helpers are nearby; use words like \"together\", \"help\", \"I can ask\"."
  },
  {
    "label": "Calm & soothing",
    "guidance": "Slow rhythm, soft words, short sentences; mention breathing or quiet moments."
  },
  {
    "label": "Curious & playful",
    "guidance": "Light, gentle fun and noticing details; keep any humour literal, no jokes that rely on figurative language."
  },
  {
    "label": "Confident & empowering",
    "guidance": "Highlight what the child can choose and do on their own; use \"I can\" and \"I choose\"."
  },
  {
    "label": "Gentle & reassuring",
    "guidance": "Repeat that feelings are okay and that the day is predictable; use \"it's okay\" and \"next\"."
  }
];

export const storyScenarios = [
  {
    "label": "School: arrival and wave",
    "focus": 0,
    "prompt": "SCENARIO: School: arrival and wave\n\nWrite a story about $CHILD_NAME arriving at school in the morning and greeting the teacher.\n\nSequence to follow: arriving at the school entrance → saying goodbye to the grown-up → walking to the classroom door → the teacher says hello → $CHILD_NAME greets back in $PRONOUN_POSSESSIVE_ADJ own way → finding $PRONOUN_POSSESSIVE_ADJ spot.\nPeople: the teacher, a few classmates, the grown-up who drops $PRONOUN_OBJECT off.\nThings $CHILD_NAME may notice: backpacks, a coat hook, other children talking, a bell (skip the bell if sounds appear in $SENSORY_SENSITIVITIES or $SENSORY_TRIGGERS).\nCompanion: one item from $INTERESTS comes along (e.g. on a backpack or as an imagined friend).\nGreeting choices must match $COMMUNICATION_MODES (wave, say \"hi\", sign hello, tap the hello button, thumbs up).\nPeople may greet in different ways and that is okay; looking at the teacher's face is not required.\nGoal for this story: $PARENT_GOAL",
    "goals": [
      "$CHILD_NAME greets the teacher at the classroom door in $PRONOUN_POSSESSIVE_ADJ own way (wave, word, sign or device).",
      "$CHILD_NAME waits for a turn to hang up $PRONOUN_POSSESSIVE_ADJ backpack at the hook.",
      "$CHILD_NAME follows the arrival steps in order: goodbye, door, hello, hook, seat.",
      "$CHILD_NAME moves from the grown-up's goodbye to the classroom using $CALMING_STRATEGIES.",
      "$CHILD_NAME uses $SAFE_WORD or $CALMING_STRATEGIES when the hallway gets busy."
    ]
  },
  {
    "label": "Playdate: meet a new friend",
    "focus": 1,
    "prompt": "SCENARIO: Playdate: meet a new friend\n\nWrite a story about $CHILD_NAME meeting a new friend for a playdate at home or a friend's home.\n\nSequence to follow: the friend arrives → saying hello → choosing something to play with → taking turns → a short break if needed → saying goodbye.\nPeople: one new friend (a first name like \"Sam\" only) and a grown-up.\nThings $CHILD_NAME may notice: new voices, toys being touched, the friend wanting to play differently.\nCompanion: choose the toy or game from $INTERESTS so $CHILD_NAME can share something $PRONOUN_SUBJECT enjoys.\nShow that the friend may like different things, and that playing side by side also counts as playing together.\nInclude $SAFE_WORD as a way to ask for a break.\nGoal for this story: $PARENT_GOAL",
    "goals": [
      "$CHILD_NAME says or shows hello when the new friend arrives.",
      "$CHILD_NAME takes turns with a toy related to $INTERESTS, using \"my turn / your turn\".",
      "$CHILD_NAME knows the playdate plan in order: hello, play, snack, goodbye.",
      "$CHILD_NAME switches from one game to the next after a warning.",
      "$CHILD_NAME uses $SAFE_WORD to take a break when play gets loud or close."
    ]
  },
  {
    "label": "Grocery store: checkout line",
    "focus": 4,
    "prompt": "SCENARIO: Grocery store: checkout line\n\nWrite a story about $CHILD_NAME going to the grocery store with a grown-up and waiting in the checkout line.\n\nSequence to follow: walking in → picking a few items from a list → joining the checkout line → waiting → putting items on the belt → the cashier scans and says hello → paying → leaving.\nPeople: the grown-up, the cashier, other shoppers in line.\nThings $CHILD_NAME may notice: the scanner beep, bright lights, a cold freezer aisle, a crowded line. Leave out anything listed in $SENSORY_SENSITIVITIES or $SENSORY_TRIGGERS; describe the rest as expected and okay.\nCompanion: $CHILD_NAME can help find one item related to $INTERESTS, or hold the list.\nShow a waiting strategy from $CALMING_STRATEGIES while the line moves slowly.\nGoal for this story: $PARENT_GOAL",
    "goals": [
      "$CHILD_NAME says or shows hello to the cashier.",
      "$CHILD_NAME waits for $PRONOUN_POSSESSIVE_ADJ turn in the checkout line.",
      "$CHILD_NAME follows the shopping steps in order: list, cart, line, pay.",
      "$CHILD_NAME leaves a favorite aisle when it's time to go to checkout.",
      "$CHILD_NAME uses $CALMING_STRATEGIES when the store is noisy or busy, and $SAFE_WORD if it's too much."
    ]
  },
  {
    "label": "Clinic: waiting room",
    "focus": 4,
    "prompt": "SCENARIO: Clinic: waiting room\n\nWrite a story about $CHILD_NAME visiting a clinic or doctor's office and waiting in the waiting room until $PRONOUN_POSSESSIVE_ADJ name is called.\n\nSequence to follow: arriving → the grown-up checks in at the desk → sitting in the waiting room → doing a quiet activity → a nurse calls $CHILD_NAME's name → walking to the room together.\nPeople: the grown-up, the person at the desk, a nurse, other families waiting.\nThings $CHILD_NAME may notice: a quiet room, a TV, other people coughing or talking, a clean smell, names being called. Leave out anything listed in $SENSORY_SENSITIVITIES or $SENSORY_TRIGGERS.\nDo NOT describe medical procedures, needles, pain or illness. The story ends when $CHILD_NAME walks into the room with the grown-up.\nCompanion: a book, toy or picture related to $INTERESTS helps pass the time.\nShow that waiting can take a while and that is okay, and use $CALMING_STRATEGIES while waiting.\nGoal for this story: $PARENT_GOAL",
    "goals": [
      "$CHILD_NAME says or shows hello to the nurse who calls $PRONOUN_POSSESSIVE_ADJ name.",
      "$CHILD_NAME understands that families are called one at a time and waits for $PRONOUN_POSSESSIVE_ADJ turn.",
      "$CHILD_NAME knows the visit steps in order: check in, wait, name called, walk to the room.",
      "$CHILD_NAME stops the waiting-room activity and walks with the nurse when called.",
      "$CHILD_NAME uses $CALMING_STRATEGIES if the room is noisy or a name is called loudly."
    ]
  },
  {
    "label": "Transitions: changing activities",
    "focus": 3,
    "prompt": "SCENARIO: Transitions: changing activities\n\nWrite a story about $CHILD_NAME stopping one activity and starting the next one (for example from playing with something related to $INTERESTS to dinner, bath or getting in the car).\n\nSequence to follow: $CHILD_NAME is enjoying an activity → the grown-up gives a warning (\"5 more minutes\", a timer or a picture card) → the warning ends → putting the activity away or saving it for later → moving to the next activity → noticing something good about the new activity.\nPeople: the grown-up.\nThings $CHILD_NAME may notice: a timer sound, a picture schedule, feeling disappointed that the fun is ending.\nUse \"first… then…\" language. Make clear the favorite activity can happen again later.\nShow one strategy from $CALMING_STRATEGIES during the switch, and $SAFE_WORD if $CHILD_NAME needs a moment.\nGoal for this story: $PARENT_GOAL",
    "goals": [
      "$CHILD_NAME says or shows \"bye for now\" to the activity and hello to the next one.",
      "$CHILD_NAME takes a turn choosing what happens next (e.g. which of two activities comes first).",
      "$CHILD_NAME follows a \"first… then…\" picture schedule through two activities.",
      "$CHILD_NAME stops an activity after the timer warning and moves to the next one.",
      "$CHILD_NAME uses $CALMING_STRATEGIES when the timer goes off or the change is unexpected."
    ]
  },
  {
    "label": "Daily routine: getting ready",
    "focus": 2,
    "prompt": "SCENARIO: Daily routine: getting ready\n\nWrite a story about $CHILD_NAME getting ready in the morning (or for bed, if $PARENT_GOAL mentions bedtime).\n\nSequence to follow, one step per page or line, always in the same order: wake up → bathroom → get dressed → breakfast → brush teeth → shoes and bag → ready to go. Combine steps if $PAGE_COUNT is small.\nPeople: the grown-up who helps.\nThings $CHILD_NAME may notice: the feel of clothes, the taste of toothpaste, running water, the clock. Leave out anything listed in $SENSORY_SENSITIVITIES or $SENSORY_TRIGGERS; describe a preferred option instead (e.g. soft clothes).\nCompanion: something related to $INTERESTS appears on a step (a picture on the cup, a song while brushing).\nUse \"first… then…\" language and end with a clear \"ready\" moment and $REINFORCEMENT.\nGoal for this story: $PARENT_GOAL",
    "goals": [
      "$CHILD_NAME says or shows \"good morning\" to the family.",
      "$CHILD_NAME waits for a turn in the bathroom or at the sink.",
      "$CHILD_NAME completes the getting-ready steps in order with less prompting.",
      "$CHILD_NAME moves from breakfast to getting shoes on when it's time to leave.",
      "$CHILD_NAME uses $CALMING_STRATEGIES when a step feels uncomfortable (e.g. a new shirt or loud hairdryer)."
    ]
  },
  {
    "label": "Park: playground interaction",
    "focus": 1,
    "prompt": "SCENARIO: Park: playground interaction\n\nWrite a story about $CHILD_NAME playing at a park playground where other children are also playing.\n\nSequence to follow: arriving at the park → choosing where to play → waiting for a turn on the slide or swing → another child says hello or wants a turn → $CHILD_NAME responds in $PRONOUN_POSSESSIVE_ADJ own way → a warning that it's almost time to leave → going home.\nPeople: the grown-up on a nearby bench, other children.\nThings $CHILD_NAME may notice: children shouting and laughing, wind, sun, the swing moving fast, a line at the slide. Leave out anything listed in $SENSORY_SENSITIVITIES or $SENSORY_TRIGGERS.\nCompanion: a game or pretend play based on $INTERESTS.\nShow that playing alone near others is okay, and that $CHILD_NAME can go to the grown-up on the bench or use $SAFE_WORD for a break.\nGoal for this story: $PARENT_GOAL",
    "goals": [
      "$CHILD_NAME responds when another child says hello at the playground.",
      "$CHILD_NAME waits in line for the slide or swing and lets another child have a turn.",
      "$CHILD_NAME knows the park plan in order: arrive, play, warning, leave.",
      "$CHILD_NAME leaves the playground after the \"5 more minutes\" warning.",
      "$CHILD_NAME uses $CALMING_STRATEGIES when the playground gets loud or crowded."
    ]
  },
  {
    "label": "Home: family time",
    "focus": 1,
    "prompt": "SCENARIO: Home: family time\n\nWrite a story about $CHILD_NAME spending time with family at home, such as a board game, building, drawing or cooking together.\n\nSequence to follow: the family chooses an activity together → setting it up → taking turns or doing parts together → a small surprise or change (e.g. a piece is missing, someone else wins) → handling it calmly → cleaning up → saying what was fun.\nPeople: family members, described by role (a parent, a sibling, a grandparent). Respect $CULTURAL_CONTEXT in the activity and family words.\nThings $CHILD_NAME may notice: different voices talking at once, someone laughing loudly, losing a game.\nCompanion: pick the activity from $INTERESTS where possible.\nShow that it's okay to win or lose, and that $CHILD_NAME can use $SAFE_WORD to take a short break and come back.\nGoal for this story: $PARENT_GOAL",
    "goals": [
      "$CHILD_NAME greets a family member who joins the activity.",
      "$CHILD_NAME takes turns in a family game and stays calm if $PRONOUN_SUBJECT doesn't win.",
      "$CHILD_NAME follows the family-time steps: choose, set up, play, clean up.",
      "$CHILD_NAME stops family game time when it's time for dinner or bed.",
      "$CHILD_NAME uses $CALMING_STRATEGIES when the room gets noisy or busy."
    ]
  },
  {
    "label": "Restaurant: dining out",
    "focus": 4,
    "prompt": "SCENARIO: Restaurant: dining out\n\nWrite a story about $CHILD_NAME eating at a restaurant with family.\n\nSequence to follow: walking in → a server shows the family to a table → looking at the menu (pictures if $COMMUNICATION_MODES includes AAC or PECS) → ordering → waiting for the food with a quiet activity → eating → paying and leaving.\nPeople: family, the server, other diners.\nThings $CHILD_NAME may notice: many people talking, clinking plates, cooking smells, food that looks different from home. Leave out anything listed in $SENSORY_SENSITIVITIES or $SENSORY_TRIGGERS.\nCompanion: a small toy, book or drawing related to $INTERESTS for the waiting time.\nShow that ordering can be done by speaking, pointing or with help from the grown-up, and that waiting for food takes time. Include $SAFE_WORD for a short break outside or in a quieter spot with the grown-up.\nGoal for this story: $PARENT_GOAL",
    "goals": [
      "$CHILD_NAME says or shows hello or thank you to the server.",
      "$CHILD_NAME waits for $PRONOUN_POSSESSIVE_ADJ turn to order and shares the table space.",
      "$CHILD_NAME knows the restaurant steps in order: sit, order, wait, eat, leave.",
      "$CHILD_NAME puts the waiting-time activity away when the food arrives.",
      "$CHILD_NAME uses $CALMING_STRATEGIES or $SAFE_WORD when the restaurant is loud or busy."
    ]
  }
];

export const masterStoryPrompt = "You are writing a personalized social story for StoryPal. An autistic child reads it together with a parent or caregiver. Write in $LANGUAGE.\n\nABOUT THE CHILD\n- Name: $CHILD_NAME, age $CHILD_AGE\n- Pronouns: $PRONOUN_SUBJECT / $PRONOUN_OBJECT / $PRONOUN_POSSESSIVE_ADJ / $PRONOUN_POSSESSIVE\n- Communicates using: $COMMUNICATION_MODES\n- Comprehension level: $COMPREHENSION_LEVEL\n- Interests (use ONE as a friendly companion or detail): $INTERESTS\n- Calming strategies: $CALMING_STRATEGIES\n- Safe word or cue for a break: $SAFE_WORD\n- Motivating rewards: $REINFORCEMENT\n- Identity language to use: $IDENTITY_LANGUAGE\n- Cultural context: $CULTURAL_CONTEXT\n- Accessibility needs: $ACCESSIBILITY_NEEDS\n\nNEVER INCLUDE (in text or image descriptions)\n- Sensory sensitivities: $SENSORY_SENSITIVITIES\n- Triggers: $SENSORY_TRIGGERS\n- Caregiver don'ts: $DOS_AND_DONTS\n- Any diagnosis, school name, address, real full name or other identifying detail.\n\nSTORY SETTINGS\n- Scenario: $SCENARIO\n- Focus skill: $FOCUS. $FOCUS_GUIDANCE\n- Tone: $TONE. $TONE_GUIDANCE\n- Parent's goal: $PARENT_GOAL\n- Exactly $PAGE_COUNT pages, split across the stages as $STAGE_SPLIT (Framing / Immersion / Reflection / Continuity).\n- At most $MAX_WORDS_PER_PAGE words of child-facing text per page.\n- Multiple-choice pages have 2 to $MAX_CHOICES options.\n\nFOUR STAGES (in order)\n1. Framing: set the scene and the goal in a calm, predictable way.\n2. Immersion: walk through what happens, step by step, including what the child may see, hear and feel.\n3. Reflection: invite the child to choose or say how they feel or what they would do.\n4. Continuity: end with a positive summary, the reward, and how this can happen again next time.\n\nWRITING RULES\n- Write mostly descriptive sentences (what happens, what people do, how people may feel). Use at most one gentle coaching sentence per page (\"I can try...\"). Never use \"must\", \"should\", \"always\" or \"never\" toward the child.\n- Be literal and concrete. No idioms, sarcasm or figures of speech (not \"break a leg\", \"butterflies in your tummy\").\n- Use the first person (\"I\") or the child's name, never \"you\" as a command.\n- Start sentences with $CHILD_NAME, not with a pronoun.\n- Every choice is acceptable; there are no wrong answers. Include the break choice $BREAK_CHOICE on the Reflection page specified in the page plan.\n- Mention $SAFE_WORD and one of $CALMING_STRATEGIES at least once, as a normal option, not a warning.\n- If $COMMUNICATION_MODES includes AAC or PECS: choices are 1–3 words each and each needs an image description. If it includes Gestures or Sign: a choice may be a gesture (\"wave\", \"thumbs up\").\n- Keep the story positive and predictable. Do not describe problems that are not part of the scenario.\n\nPARENT GUIDE (one per page)\n- title: 2–4 words.\n- description: one sentence on why this page matters.\n- coActionPrompt: one thing the parent says or does together with the child. It must refer to the exact text and choices on THIS page.\n- On every page with a question, add: \"Wait $RESPONSE_LATENCY before helping.\" Add \"$CHILD_NAME's yes/no: $YES_NO_CONVENTION\" if provided, and \"If you notice $NOT_UNDERSTANDING_SIGNALS, read the page again more slowly\" if provided.\n- Respect $DOS_AND_DONTS and $DEESCALATION_STRATEGIES. Use $CAREGIVER_NOTES as background only.\n\nReturn only JSON in the format given at the end of this prompt.";
