/**
 * objectExplainerService.js
 * Live Object Explainer — Knowledge Base & TF.js Label Mapper
 *
 * Maps COCO-SSD detected object labels → rich, accessible explanations
 * with What-it-is, How-to-use, and usage tips.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Knowledge Base
// ─────────────────────────────────────────────────────────────────────────────

export const OBJECT_KNOWLEDGE_BASE = {
  atm: {
    emoji: '🏧',
    name: 'ATM Machine',
    category: 'Banking',
    what: 'An ATM (Automated Teller Machine) is a self-service banking kiosk that lets you withdraw cash, check your account balance, transfer money, and sometimes even deposit cash — without visiting a bank branch.',
    howTo: `Step 1: Insert your debit or credit card into the card slot.\nStep 2: Enter your secret 4-digit PIN on the keypad.\nStep 3: Select the service you need — Withdraw, Balance Check, or Transfer.\nStep 4: Enter the amount and confirm.\nStep 5: Collect your cash and card. Always take your receipt!`,
    tips: '🔒 Always cover the keypad with your hand when typing your PIN. Never share your PIN with anyone!',
    color: '#0ea5e9',
  },

  'cell phone': {
    emoji: '📱',
    name: 'Mobile Phone / Smartphone',
    category: 'Device',
    what: 'A smartphone is a pocket-sized computer that lets you call, text, browse the internet, take photos, use apps, navigate maps, and much more.',
    howTo: `Step 1: Press the side or top button to wake the screen.\nStep 2: Swipe up or enter your PIN/fingerprint to unlock.\nStep 3: Tap apps to open them. Swipe left or right to switch between screens.\nStep 4: Tap the phone icon to make a call. Tap the camera icon to take photos.\nStep 5: Press the home button or swipe up to go back to the main screen.`,
    tips: '🔋 Charge your phone when the battery drops below 20%. Keep your screen locked with a PIN for security.',
    color: '#7c6af7',
  },

  laptop: {
    emoji: '💻',
    name: 'Laptop Computer',
    category: 'Device',
    what: 'A laptop is a portable personal computer with a built-in screen, keyboard, and battery. You can use it for work, study, browsing the internet, watching videos, and creating documents anywhere.',
    howTo: `Step 1: Open the lid and press the power button (usually top-right corner).\nStep 2: Wait for it to boot up and log in with your username and password.\nStep 3: Use the trackpad (smooth surface below keyboard) to move the cursor. Tap to click.\nStep 4: Type using the keyboard. Press Enter to confirm.\nStep 5: Close the lid to sleep the laptop when done.`,
    tips: '⚡ Keep your laptop plugged in for long work sessions. Use a padded bag to protect it when carrying.',
    color: '#6366f1',
  },

  keyboard: {
    emoji: '⌨️',
    name: 'Computer Keyboard',
    category: 'Device',
    what: 'A keyboard is an input device used to type text, numbers, and commands into a computer. It has letter keys (A-Z), number keys, special keys like Enter, Space, Backspace, and function keys (F1-F12).',
    howTo: `Step 1: Connect to your computer via USB cable or wirelessly via Bluetooth.\nStep 2: Place both hands on the keyboard — left on ASDF, right on JKL;\nStep 3: Type characters using your fingers. Press Spacebar between words.\nStep 4: Press Enter/Return to start a new paragraph or confirm an action.\nStep 5: Use Backspace to delete, Ctrl+C to copy, Ctrl+V to paste.`,
    tips: '🧹 Clean your keyboard regularly with a soft brush or compressed air to remove dust between keys.',
    color: '#8b5cf6',
  },

  mouse: {
    emoji: '🖱️',
    name: 'Computer Mouse',
    category: 'Device',
    what: 'A computer mouse is a pointing device that controls the cursor on your screen. Moving the mouse moves the cursor, clicking selects items, and the scroll wheel lets you scroll up and down pages.',
    howTo: `Step 1: Place the mouse on a flat surface (a mouse pad works best).\nStep 2: Move the mouse to move the cursor on screen.\nStep 3: Left-click (press left button) to select items or open files.\nStep 4: Right-click to open a context menu with options.\nStep 5: Scroll the wheel in the middle to scroll up and down webpages.`,
    tips: '🖱️ If the cursor jumps around, try using a mouse pad. Optical mice work best on non-reflective surfaces.',
    color: '#a78bfa',
  },

  tv: {
    emoji: '📺',
    name: 'Television (TV)',
    category: 'Device',
    what: 'A TV (Television) is an electronic device that displays moving images and plays audio. Modern Smart TVs connect to the internet and let you stream shows, movies, and play games.',
    howTo: `Step 1: Press the power button on the remote or on the TV itself.\nStep 2: Use the remote's up/down/left/right arrows to navigate the menu.\nStep 3: Press OK or Enter to select a channel or app.\nStep 4: Use the volume buttons (+/-) on the remote to adjust sound.\nStep 5: Press the Home button to return to the main screen. Press power to turn off.`,
    tips: '📏 Sit at least 5–6 feet away from the TV to protect your eyesight. Reduce brightness in dark rooms.',
    color: '#0891b2',
  },

  bottle: {
    emoji: '💊',
    name: 'Medicine / Supplement Bottle',
    category: 'Medicine',
    what: 'This appears to be a medicine or supplement container. It holds tablets, capsules, or liquid medication prescribed by a doctor or available over-the-counter for treating health conditions.',
    howTo: `Step 1: Read the label carefully — check the medicine name, dose, and expiry date.\nStep 2: Press down and twist the cap (child-proof caps require pressing firmly while turning).\nStep 3: Take the correct number of tablets/capsules as directed.\nStep 4: Swallow with a full glass of water unless instructed otherwise.\nStep 5: Replace the cap tightly and store in a cool, dry place away from children.`,
    tips: '⚠️ NEVER take someone else\'s medicine. Always follow the prescribed dosage. Check the expiry date before use.',
    color: '#10b981',
  },

  book: {
    emoji: '📚',
    name: 'Book',
    category: 'Education',
    what: 'A book is a physical collection of written or printed pages bound together. Books can be textbooks for learning, storybooks for entertainment, or reference books for information.',
    howTo: `Step 1: Open the book from the front cover — pages go left to right (in English).\nStep 2: Look at the Table of Contents at the front to find specific chapters.\nStep 3: Read page by page, left to right, top to bottom.\nStep 4: Use a bookmark to save your place when you stop reading.\nStep 5: Handle pages gently — avoid bending the spine backward.`,
    tips: '💡 Take notes or highlight key points to remember what you read. Reading in good light prevents eye strain.',
    color: '#f59e0b',
  },

  clock: {
    emoji: '🕐',
    name: 'Clock',
    category: 'Device',
    what: 'A clock is a timekeeping device that displays the current hour and minute. Analog clocks have two hands pointing to numbers 1-12. Digital clocks show the time as numbers.',
    howTo: `Step 1 (Analog): The short (hour) hand points to the hour. The long (minute) hand points to the minute.\nStep 2: Each number on an analog clock represents 5 minutes. 12 = 0 minutes, 3 = 15 min, 6 = 30 min, 9 = 45 min.\nStep 3 (Digital): Read the numbers directly — 9:30 means 9 hours and 30 minutes.\nStep 4: AM = morning (midnight to noon). PM = afternoon/night (noon to midnight).`,
    tips: '⏰ Set an alarm for important events so you never miss them!',
    color: '#f97316',
  },

  remote: {
    emoji: '📡',
    name: 'Remote Control',
    category: 'Device',
    what: 'A remote control is a wireless handheld device that lets you control electronic devices (TVs, AC, music players) from a distance using infrared signals.',
    howTo: `Step 1: Point the remote at the device (the small clear sensor at the top sends signals).\nStep 2: Press the Power button to turn the device on or off.\nStep 3: Use number buttons to select channels directly, or use CH+/CH- to go up/down.\nStep 4: Use VOL+/VOL- to adjust volume.\nStep 5: If it stops working, replace the batteries (usually in a compartment at the back).`,
    tips: '🔋 Replace batteries when buttons require harder pressing or the range decreases.',
    color: '#ec4899',
  },

  'traffic light': {
    emoji: '🚦',
    name: 'Traffic Signal / Traffic Light',
    category: 'Public Infrastructure',
    what: 'A traffic signal (traffic light) is a signaling device that controls the flow of vehicles and pedestrians at road intersections to prevent accidents and organize traffic.',
    howTo: `🔴 RED: STOP — Do not cross or proceed. Wait behind the line.\n🟡 YELLOW/AMBER: PREPARE — Get ready to stop or proceed if already moving.\n🟢 GREEN: GO — Proceed safely when the path is clear.\nFor pedestrians: Wait for the green walking figure before crossing. Always look both ways even on green.`,
    tips: '⚠️ Never run a red light — it is dangerous and illegal. Even on green, watch for vehicles before crossing.',
    color: '#ef4444',
  },

  'parking meter': {
    emoji: '🎫',
    name: 'Parking Meter / Ticket Machine',
    category: 'Public Machine',
    what: 'A parking meter or ticket machine is a public self-service device that issues parking permits or transit tickets when you pay the required fee.',
    howTo: `Step 1: Read the instructions displayed on the screen or panel.\nStep 2: Select your destination or duration using the buttons.\nStep 3: Insert coins or tap/swipe your card on the payment reader.\nStep 4: Wait for the machine to process and print your ticket.\nStep 5: Collect your ticket and keep it visible in your vehicle or with you.`,
    tips: '📋 Keep your receipt as proof of payment. Check the validity time — overstaying can result in fines.',
    color: '#14b8a6',
  },

  chair: {
    emoji: '🪑',
    name: 'Chair',
    category: 'Furniture',
    what: 'A chair is a piece of furniture designed for one person to sit on. Chairs can be wooden, plastic, metal, or padded, and are used at desks, dining tables, in waiting rooms, and more.',
    howTo: `Step 1: Position the chair on a flat, stable surface.\nStep 2: Sit down slowly, lowering yourself by bending your knees.\nStep 3: Sit with your back straight and feet flat on the floor for good posture.\nStep 4: For adjustable office chairs, use the lever underneath to set the height.`,
    tips: '🪑 Avoid slouching — sit up straight to protect your spine. Take short breaks from sitting every 30 minutes.',
    color: '#a16207',
  },

  cup: {
    emoji: '☕',
    name: 'Cup / Mug',
    category: 'Kitchenware',
    what: 'A cup or mug is a container used for drinking hot or cold beverages like water, tea, coffee, or juice. Mugs typically have handles; cups may or may not.',
    howTo: `Step 1: Ensure the cup is clean before use.\nStep 2: Pour your drink carefully — fill to about 3/4 full to avoid spilling.\nStep 3: Hold the handle (if present) to avoid burning hands with hot drinks.\nStep 4: Sip slowly from hot beverages — let them cool a little first.\nStep 5: Wash with soap and water after use.`,
    tips: '♻️ Use a reusable mug instead of disposable cups to help the environment!',
    color: '#b45309',
  },

  person: {
    emoji: '🧍',
    name: 'Person Detected',
    category: 'People',
    what: 'The camera is detecting a person in the frame. Try pointing the camera at an object like a phone, laptop, medicine bottle, book, or appliance for a full explanation!',
    howTo: 'Point the camera at a specific object — like an ATM, device, medicine bottle, or machine — and I\'ll explain everything about it!',
    tips: '📷 For best results, hold the object steady, ensure good lighting, and keep it centered in frame.',
    color: '#64748b',
  },

  default: {
    emoji: '🔍',
    name: 'Object Detected',
    category: 'Unknown',
    what: 'I can see an object in your camera! While I don\'t have specific information about this exact item, it appears to be something you use in your daily environment.',
    howTo: 'For best results, try pointing at: ATM machines, medicine bottles, mobile phones, laptops, TVs, keyboards, books, clocks, or ticket machines.',
    tips: '💡 Make sure the object is well-lit and centered in frame for better detection accuracy.',
    color: '#7c6af7',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// TF.js COCO-SSD Label → Knowledge Base Key Mapper
// ─────────────────────────────────────────────────────────────────────────────

const LABEL_MAP = {
  // Devices
  'cell phone': 'cell phone',
  'laptop': 'laptop',
  'keyboard': 'keyboard',
  'mouse': 'mouse',
  'tv': 'tv',
  'television': 'tv',
  'monitor': 'tv',
  'remote': 'remote',

  // Medicine / Bottles
  'bottle': 'bottle',
  'medicine': 'bottle',

  // Public Infrastructure
  'parking meter': 'parking meter',
  'traffic light': 'traffic light',

  // Common Objects
  'book': 'book',
  'clock': 'clock',
  'chair': 'chair',
  'cup': 'cup',

  // People
  'person': 'person',
};

/**
 * Gets the structured explanation for a detected TF.js COCO-SSD label.
 * Falls back to the 'default' entry if no match found.
 * @param {string} tfLabel - Label returned by COCO-SSD model
 * @returns {Object} Object explanation entry from OBJECT_KNOWLEDGE_BASE
 */
export const getObjectExplanation = (tfLabel) => {
  if (!tfLabel) return OBJECT_KNOWLEDGE_BASE.default;

  const normalized = tfLabel.toLowerCase().trim();

  // Direct map check
  if (LABEL_MAP[normalized]) {
    const key = LABEL_MAP[normalized];
    return OBJECT_KNOWLEDGE_BASE[key] || OBJECT_KNOWLEDGE_BASE.default;
  }

  // Partial keyword match
  for (const [mapKey, knowledgeKey] of Object.entries(LABEL_MAP)) {
    if (normalized.includes(mapKey) || mapKey.includes(normalized)) {
      return OBJECT_KNOWLEDGE_BASE[knowledgeKey] || OBJECT_KNOWLEDGE_BASE.default;
    }
  }

  // ATM heuristic — COCO doesn't detect ATMs; users can trigger manually
  if (normalized.includes('atm') || normalized.includes('machine') || normalized.includes('kiosk')) {
    return OBJECT_KNOWLEDGE_BASE.atm;
  }

  return OBJECT_KNOWLEDGE_BASE.default;
};

/**
 * Gets all manually browsable object entries (for the object browser panel)
 */
export const getAllObjectKeys = () => Object.keys(OBJECT_KNOWLEDGE_BASE).filter(k => k !== 'default');

/**
 * Formats the full spoken explanation combining What + HowTo
 */
export const getSpokenExplanation = (entry) => {
  if (!entry) return '';
  return `${entry.name}. ${entry.what} Here is how to use it: ${entry.howTo.replace(/\n/g, '. ')} Tip: ${entry.tips}`;
};
