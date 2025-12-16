// project configuration constants
"use strict";

function Chore(name, date = new Date()) {
  this.name = name;
  this.date = date;
}

class ChoreManager {
  constructor(cardElement, app) {
    this.card = cardElement; // card element is the container for the task information of this user
    this.user = cardElement.dataset.user;
    this.app = app; // Reference to app for state operations

    // initialize empty state
    this.currentChores = [];
    this.choresTarget = 0;
    this.count = 0;

    // Cache elements
    this.elements = {
      counter: cardElement.querySelector(".user-card__chore-count"),
      progress: cardElement.querySelector(".user-card__progress"),
      remaining: cardElement.querySelector(".user-card__remaining"),
      list: cardElement.querySelector(".chore-list"),
      nameInput: cardElement.querySelector(".user-card__new-chore-input"),
      buttonAdd: cardElement.querySelector(".user-card__new-chore-button"),
    };

    // Setup event listeners
    this.elements.buttonAdd.addEventListener(
      "click",
      this.#handlerAddChore.bind(this)
    );
    this.elements.nameInput.addEventListener("keypress", (event) => {
      if (event.key === "Enter") {
        this.#handlerAddChore();
      }
    });
  }

  #handlerAddChore() {
    // event handler for adding a new chore
    const choreName = this.elements.nameInput.value.trim();
    if (!choreName) {
      return; // ignore empty input
    }
    console.log(`${this.user} selected ${choreName}`);
    showSuccess(`Chore "${choreName}" added for ${this.user}`, "Chore Added");

    // Add chore and save through app
    this.currentChores.push(new Chore(choreName));
    this.#saveState();
    this.update();

    this.elements.nameInput.value = ""; // clear input
  }

  async #saveState() {
    // Save current state through app's simple API
    try {
      const currentState = await this.app.getState();
      if (currentState && currentState[this.user]) {
        currentState[this.user].choreList = this.currentChores.map((chore) => ({
          name: chore.name,
          date: chore.date.toISOString(),
        }));
        await this.app.saveState(currentState);
      }
    } catch (error) {
      console.error(`Failed to save state for ${this.user}:`, error);
      showError(`Failed to save chore for ${this.user}`);
    }
  }

  setState(userData) {
    // set the state of the chore manager from data
    this.currentChores = userData.choreList.map(
      ({ name, date }) => new Chore(name, new Date(date))
    );
    this.choresTarget = userData.config.tasksPerWeek;
  }

  async update(giveCompliment = false) {
    // assuming that we can use the currentConfig to get user info

    this.count = this.currentChores.length;

    // update the elements
    this.elements.counter.textContent = `${this.count} / ${this.choresTarget} chores`;

    // update progress bar
    const percentage = Math.round(
      100 * Math.min(this.count / this.choresTarget, 1),
      0
    );
    const red = Math.round(220 - percentage * 2.2); // 220 -> 0
    const green = Math.round(percentage * 2.2); // 0 -> 220
    const blue = 0;

    this.elements.progress.style.backgroundColor = `rgb(${red}, ${green}, ${blue})`;
    this.elements.progress.style.width = percentage + "%";

    // update the remaining tasks element
    this.elements.remaining.textContent =
      this.count < this.choresTarget
        ? `nog ${this.choresTarget - this.count} te gaan`
        : "allemaal klaar!";

    // update the chore list
    if (this.count === 0) {
      this.elements.list.innerHTML = `<p class="small text-muted text-center py-4">
        No chores yet this week
      </p>`;
    } else {
      this.elements.list.innerHTML = "";
      this.currentChores
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .forEach((chore) => {
          const choreElement = document.createElement("div");
          choreElement.className =
            "chore border-start border-success border-3 ps-2 mb-2 shadow-sm p-2";

          const choreDate = new Date(chore.date);
          const today = new Date();
          const isToday =
            choreDate.getDate() === today.getDate() &&
            choreDate.getMonth() === today.getMonth() &&
            choreDate.getFullYear() === today.getFullYear();
          const isYesterday =
            choreDate.getDate() === today.getDate() - 1 &&
            choreDate.getMonth() === today.getMonth() &&
            choreDate.getFullYear() === today.getFullYear();

          let displayDate = new Date(chore.date).toLocaleDateString(
            window.navigator.language,
            {
              day: "numeric",
              month: "short",
            }
          );

          if (isToday) {
            displayDate = "vandaag";
          } else if (isYesterday) {
            displayDate = "gisteren";
          }

          choreElement.innerHTML = `
          <div class="d-flex justify-content-between align-items-center">
            <span class="task__title fw-medium">${chore.name}</span>
            <small class="task__date"><time datetime="${chore.date.toISOString()}">${displayDate}</time></small>
          </div>
        `;
          this.elements.list.appendChild(choreElement);
        });
    }

    if (giveCompliment) {
      const complimentjes = currentConfig.messages || defaultComplimentjes;
      const randomIndex = Math.floor(Math.random() * complimentjes.length);
      const compliment = complimentjes[randomIndex];


      if (this._timeOutId) clearTimeout(this._timeOutId);

      this.progressBar.innerText = compliment;
      this._timeOutId = setTimeout(
        () => (this.progressBar.innerText = ""),
        2000
      );
      if (progress === "100%") {
        celebrationBurst();
      }
    }
  }
}


// Default fallback values
const defaultComplimentjes = [
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
];

class App {
  constructor() {
    this.#setupChoreManagers();
    // this.#generateTaskTable();
    this.#setupEventListeners();
    this.update();
  }

    // Constructor and initialization methods
  #setupChoreManagers() {
    // Create chore managers with app reference
    this.children = [];
    Array.from(document.querySelectorAll(".user-card[data-user]")).forEach(
      (card) =>
        this.children.push(new ChoreManager(card, this))
    );
  }

  #setupEventListeners() {

    // event for reset button
    const buttonReset = document.getElementById("reset");
    buttonReset.addEventListener("click", async () => {
      fetch("/api/reset", { method: "POST" })
      .then((response) => response.json())
      .then((result) => {
        if (result.success) {
          showSuccess("Application state has been reset", "Reset Successful");
          this.update();
        } else {
          showError("Failed to reset application state", "Reset Failed");
        } 
      })
      .catch((error) => {
        console.error("Error resetting application state:", error);
        showError("Error resetting application state", "Reset Failed");
      });
    })
  }
  
  static async create() {
    // create an app instances after loading config
    console.log("Creating app instance with config:", currentConfig);

    await configReady;
    return new App();
  }

  // Simple state management methods
  async getState() {

    fetch("/api/state")
      .then((response) => response.json())
      .then((result) => {
        return result.data;
      })
      .catch((error) => {
        console.error("Error fetching state:", error);
        return null;
      });
    }

  async saveState(state) {
    // save state through backend API
    return fetch("/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    })
      .then((response) => response.json())
      .then((result) => {
      if (!result.success) {
        throw new Error(result.error);
      }
      return true;
      })
      .catch((error) => {
      console.error("Error saving state:", error);
      throw error;
      });
  }


  async update() {
    // Update all chore managers

    try {
      const data = await this.getState();
      if (data) {
        console.log("App update - loaded state:", data);
        self.children.forEach((widget) => widget.update());
      }
    } catch (error) {
      console.error("Error fetching state for update:", error);
      showError("Failed to update application state");
    }
  }
}

// setup of the flow
function setupEventListeners() {
  // references to progress bars and buttons used in functions
  const taskButtonsGeneral = document.querySelectorAll("table .general-task");
  const buttonReset = document.getElementById("reset");

  // Event listeners for user buttons
  Object.keys(currentConfig.users).forEach((userId) => {
    const userButtons = document.querySelectorAll(`.btn-${userId}`);
    userButtons.forEach((button) => {
      button.addEventListener("click", () => {
        let countChange = button.classList.contains("active") ? -1 : 1;
        button.classList.toggle("active");

        if (window.progressBars[userId]) {
          window.progressBars[userId].done += countChange;
          window.progressBars[userId].updateProgress(countChange === 1);
        }

        if (countChange === 1) {
          // Show confetti based on user
          if (userId === "milou") {
            sideConfetti("left");
          } else if (userId === "luca") {
            sideConfetti("right");
          } else {
            sideConfetti("both");
          }
        }
        storeState();
      });
    });
  });

  taskButtonsGeneral.forEach((button) => {
    button.addEventListener("click", () => {
      const isActive = button.classList.toggle("active");
      button.innerText = isActive ? " 🎉 " : "...";
      if (isActive) {
        // Big celebration for general tasks
        sideConfetti("both");
      }
      storeState();
    });
  });

  buttonReset.addEventListener("click", async () => {
    await storeState(true);
    await updateApp();
  });
}

async function getState() {
  try {
    const response = await fetch("/api/state");
    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error("Error fetching state:", error);
    return null;
  }
}
async function storeState(reset = false) {
  // store state of the buttons to backend API
  // if reset=true stored false for all states in order to reset the app
  let stateData = {};

  if (reset) {
    // use the reset api
    try {
      const response = await fetch("/api/reset", {
        method: "POST",
      });
      const result = await response.json();
      if (!result.success) {
        console.error("Failed to reset state:", result.error);
      }
    } catch (error) {
      console.error("Error resetting state:", error);
    }
  } else {
    // gather current state from buttons and use the save api
    const isActive = (x) => x.classList.contains("active");

    // Store state for each user
    for (const userId of Object.keys(currentConfig.users)) {
      const userButtons = document.querySelectorAll(`.btn-${userId}`);
      stateData[userId] = [...userButtons].map(isActive);
    }

    // Store state for general tasks
    const generalButtons = document.querySelectorAll(".general-task");
    stateData.general = [...generalButtons].map(isActive);

    try {
      const response = await fetch("/api/state", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(stateData),
      });

      const result = await response.json();
      if (!result.success) {
        console.error("Failed to save state:", result.error);
      }
      console.log("State stored successfully:", stateData);
    } catch (error) {
      console.error("Error storing state:", error);
    }
  }
}

async function updateApp() {
  // synchronize button status with task state from backend API
  let storedButtonStates = {};
  try {
    const response = await fetch("/api/state");
    const result = await response.json();
    storedButtonStates = result.data;

    if (!result.success) {
      console.error("Unsuccessful in loading /api/state:", result.error);
      return;
    }
  } catch (error) {
    console.error("Error loading state:", error);
    for (const userId of Object.keys(currentConfig.users)) {
      if (window.progressBars && window.progressBars[userId]) {
        window.progressBars[userId].done = 0;
        window.progressBars[userId].updateProgress();
      }
    }
    return;
  }

  console.log("updateApp - state loaded:", storedButtonStates);

  function applyStateToButtonList(buttonNodes, isActiveArray) {
    // sets buttons to active based on state data
    isActiveArray.forEach((value, index) => {
      if (buttonNodes[index]) {
        value
          ? buttonNodes[index].classList.add("active")
          : buttonNodes[index].classList.remove("active");
      }
    });
  }

  // Apply state for each user
  for (const userId of Object.keys(currentConfig.users)) {
    if (storedButtonStates[userId]) {
      const userButtons = document.querySelectorAll(`.btn-${userId}`);
      applyStateToButtonList(userButtons, storedButtonStates[userId]);

      // Update progress bars
      if (window.progressBars && window.progressBars[userId]) {
        window.progressBars[userId].done = storedButtonStates[userId].filter(
          (x) => x
        ).length;
        window.progressBars[userId].updateProgress();
      }
    }
  }

  if (storedButtonStates.general) {
    const generalButtons = document.querySelectorAll(".general-task");
    // Apply state for general tasks
    applyStateToButtonList(generalButtons, storedButtonStates.general);
    // Update general button text
    generalButtons.forEach((button) => {
      button.innerText = button.classList.contains("active") ? " 🎉 " : "...";
    });
  }
}

// Confetti utility functions
function createConfetti(options = {}) {
  const defaults = {
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
    angle: 90,
    startVelocity: 45,
    colors: ["#bb0000", "#ffffff", "#00bb00", "#0000bb", "#bbbb00"],
  };

  const config = { ...defaults, ...options };

  confetti(config);
}

function sideConfetti(side = "both") {
  const leftConfig = {
    particleCount: 50,
    angle: 60,
    spread: 55,
    origin: { x: 0, y: 0.6 },
    startVelocity: 45,
  };

  const rightConfig = {
    particleCount: 50,
    angle: 120,
    spread: 55,
    origin: { x: 1, y: 0.6 },
    startVelocity: 45,
  };

  if (side === "left" || side === "both") {
    createConfetti(leftConfig);
  }

  if (side === "right" || side === "both") {
    createConfetti(rightConfig);
  }
}

function celebrationBurst() {
  // Multiple bursts for celebration
  createConfetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
  });

  setTimeout(() => sideConfetti("both"), 250);

  setTimeout(() => {
    createConfetti({
      particleCount: 50,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
    });
    createConfetti({
      particleCount: 50,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
    });
  }, 500);
}

/*
Design overview, what kind of operations do I have

update single process bar from a button update

update all from reset button -> set all buttons and update both progress bars separately
update all from data load -> set all buttons and update both progress bars separately
*/

// Toast notification utilities
function showToast(message, type = "info", title = null, duration = 5000) {
  const toast = document.getElementById("notification-toast");
  const toastIcon = document.getElementById("toast-icon");
  const toastTitle = document.getElementById("toast-title");
  const toastMessage = document.getElementById("toast-message");

  // Configure based on type
  const configs = {
    success: {
      icon: "fa-check-circle",
      color: "text-success",
      title: "Success",
    },
    error: {
      icon: "fa-exclamation-circle",
      color: "text-danger",
      title: "Error",
    },
    warning: {
      icon: "fa-exclamation-triangle",
      color: "text-warning",
      title: "Warning",
    },
    info: { icon: "fa-info-circle", color: "text-info", title: "Info" },
  };

  const config = configs[type] || configs.info;

  // Update toast content
  toastIcon.className = `fas ${config.icon} ${config.color} me-2`;
  toastTitle.textContent = title || config.title;
  toastMessage.textContent = message;

  // Show toast
  const bsToast = new bootstrap.Toast(toast, {
    delay: duration,
  });
  bsToast.show();
}

// Convenience functions
function showSuccess(message, title = null) {
  showToast(message, "success", title);
}

function showError(message, title = null) {
  showToast(message, "error", title);
}

function showWarning(message, title = null) {
  showToast(message, "warning", title);
}

function showInfo(message, title = null) {
  showToast(message, "info", title);
}

// Initialize the application
(async () => {
  await storeState(true); // reset state on load
  const app = await App.create();
  globalThis.app = app; // Works in all environments
})();
