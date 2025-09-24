const defaultConfig = {
  users: {
    milou: {
      tasksPerWeek: 7,
      color: "#0ef706dc",
      displayName: "Milou",
    },
    luca: {
      tasksPerWeek: 7,
      color: "#29b100",
      displayName: "Luca",
    },
  },
  generalTasks: {
    count: 2,
    tasks: ["Huiskamer opruimen", "Takken verzorgen"],
  },
  personalTasks: [
    "Vaatwasser",
    "tafel dekken/afruimen",
    "Koken",
    "Vuilnis/Papier wegbrengen",
    "Kamer opruimen",
    "Boodschappen",
    "Overig",
    "Joker",
  ],
  weekdays: [
    "Zondag",
    "Maandag",
    "Dinsdag",
    "Woensdag",
    "Donderdag",
    "Vrijdag",
    "Zaterdag",
  ],
  messages: [
    "lekker bezig! 🚀",
    "ga zo door! 🌟",
    "held! 💪",
    "knapperd! 😎",
    "je hebt jezelf overtroffen! 🎉",
    "je bent een topper! ⭐",
    "fantastisch werk! 👏",
    "je maakt het verschil! 🌈",
    "je rockt! 🎸",
    "briljant gedaan! 💡",
    "superster! 🌟",
    "gewoon geweldig! 🏆",
  ],
};

let currentConfig = defaultConfig;

async function fetchConfigFromServer() {
  // Fetch configuration from the server
  // This function only fetches the config data and returns the operation result
  try {
    const response = await fetch("/api/config");
    const result = await response.json();

    if (result.success) {
      currentConfig = result.data;
      return { success: true, data: result.data };
    } else {
      return { success: false, error: result.error };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function saveConfigToServer(newConfig) {
  // Save configuration to the server
  // This function only sends the config data to the server and returns the operation result
  try {
    const response = await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newConfig),
    });
    const result = await response.json();

    if (result.success) {
      return { success: true };
    } else {
      return { success: false, error: result.error };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}
