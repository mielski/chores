// project configuration constants
"use strict";

function Chore(description, date = new Date()) {
  this.description = description;
  this.date = date;
}

class ChoreManager {
  constructor(cardElement) {
    this.card = cardElement;
    this.user = cardElement.dataset.user;

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
    this.elements.buttonAdd.addEventListener("click", this.#addChoreHandler.bind(this));
    this.elements.nameInput.addEventListener("keypress", (event) => {
      if (event.key === "Enter") {
        this.#addChoreHandler();
      };
    });
  }

  #addChoreHandler() {
    // event handler for adding a new chore
    const choreName = this.elements.nameInput.value.trim();
    if (!choreName) {
      return; // ignore empty input
    }
    console.log(`${this.user} selected ${choreName}`);
    showSuccess(`Chore "${choreName}" added for ${this.user}`, "Chore Added");
    this.currentChores.push(new Chore(choreName));
    this.update();

    this.elements.nameInput.value = ""; // clear input
    };

  update(giveCompliment = false) {
    // assuming that we can use the currentConfig to get user info

    this.choresTarget = currentConfig.users[this.user].tasksPerWeek;
    this.count = this.currentChores.length;

    // update the elements
    this.elements.counter.textContent = `${this.count} / ${this.choresTarget} chores`;
    const progressPercent =
      Math.round(100 * Math.min(this.count / this.choresTarget, 1), 0) + "%";
    this.elements.progress.style.width = progressPercent;
    this.elements.remaining.textContent =
      this.count < this.choresTarget
        ? `nog ${this.choresTarget - this.count} te gaan`
        : "allemaal klaar!";

    if (this.count === 0) {
      this.elements.list.innerHTML = `<p class="small text-muted text-center py-4">
        No chores yet this week
      </p>`;
    } else {
      this.elements.list.innerHTML = "";
      this.currentChores.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach((chore) => {
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
        
        let displayDate = new Date(chore.date).toLocaleDateString();
        if (isToday) {
          displayDate = "vandaag";
        } else if (isYesterday) {
          displayDate = "gisteren";
        }

        choreElement.innerHTML = `
          <div class="d-flex justify-content-between align-items-center">
            <span class="task__title fw-medium">${chore.description}</span>
            <small class="task__date"><time datetime="${chore.date.toISOString()}">${displayDate}</time></small>
          </div>
        `;
        this.elements.list.appendChild(choreElement);
      });
    }

    if (giveCompliment) {
      // TODO
    }
  }
}

// Usage - works for any number of cards

class ProgressBar {
  // Class to handle the progress bar updates
  // It takes an HTML element and the total number of tasks as parameters
  // It has a method to update the progress bar and optionally show a compliment
  // It also handles the timeout for showing the compliment
  constructor(element, totalTasks) {
    // element: HTML element for the progress bar
    // totalTasks: total number of tasks to complete (integer)
    this.progressBar = element;
    this.done = 0;
    this.required = totalTasks;
    this.timeoutId = undefined;
  }

  updateProgress(giveCompliment = false) {
    const complimentjes = currentConfig.messages || defaultComplimentjes;
    const randomIndex = Math.floor(Math.random() * complimentjes.length);
    const compliment = complimentjes[randomIndex];

    const progress =
      Math.round(100 * Math.min(this.done / this.required, 1), 0) + "%";
    this.progressBar.style.width = progress;

    if (this._timeOutId) clearTimeout(this._timeOutId);

    if (giveCompliment) {
      this.progressBar.innerText = compliment;
      this._timeOutId = setTimeout(
        () => (this.progressBar.innerText = progress),
        2000
      );
      if (progress === "100%") {
        celebrationBurst();
      }
    } else {
      this.progressBar.innerText = progress;
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
    // this.#setupEventListeners();
    this.update();
  }

  static async create() {
    // create an app instances after loading config
    console.log("Creating app instance with config:", currentConfig);

    await configReady;
    return new App();
  }

  // Constructor and initialization methods

  #setupChoreManagers() {
    // Create progress bars for each user
    this.choreManagers = {};
    Array.from(document.querySelectorAll(".user-card[data-user]")).forEach(
      (card) => (this.choreManagers[card.dataset.user] = new ChoreManager(card))
    );
  }

  update(giveCompliment = false) {
    // Update all chore managers
    Object.values(this.choreManagers).forEach((manager) =>
      manager.update(giveCompliment)
    );
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
  const app = await App.create();
  globalThis.app = app; // Works in all environments
})();
