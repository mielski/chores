// project configuration constants
"use strict";

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
    // creates a new chore from the input elements
    // updates the app state through the app reference
    const choreName = this.elements.nameInput.value.trim();
    const choreDateString = new Date().toISOString().slice(0, 10); // current date in ISO format
    if (!choreName) {
      return; // ignore empty input
    }
    console.log(`${this.user} selected ${choreName}`);

    // Add chore and save through app
    this.currentChores.push({name: choreName, date: choreDateString});

    const state = this.app.getState();
    state[this.user].choreList = [...this.currentChores];
    this.app.setState(state);

    this.elements.nameInput.value = ""; // clear input
    this.updateWidget();
  }

  setState(userData) {
    // set the state of the chore manager from data
    this.currentChores = [...userData.choreList] || [];
    this.choresTarget = userData.settings.tasksPerWeek;
  }

  async updateFromAppState() {
    // updates the widget state from the general app state
    const stateData = this.app.getState();
    if (stateData && stateData[this.user]) {
      this.setState(stateData[this.user]);
      this.updateWidget();
    } else {
      console.warn(`No state data found for user ${this.user}`);
    }
  }

  async updateWidget() {
    // assuming that we can rely on the widget state 

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
          const isToday = choreDate.getTime() + 3600_000 * 24 > today.valueOf()
          const isYesterday =
            choreDate.getTime() + 3600_000 * 48 > today.valueOf() && !isToday;

          let displayDate = choreDate.toLocaleDateString(
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
            <small class="task__date"><time datetime="${chore.date}">${displayDate}</time></small>
          </div>
        `;
          this.elements.list.appendChild(choreElement);
        });
    }

    if (this.choresTarget === this.count) {
      celebrationBurst();
    }
  }
}

class App {
  constructor() {
    this.previousStates = [];  // stores the last 3 previous states for undo operations
    this.state = null; // current application state
    this.#setupChoreManagers();
    // this.#generateTaskTable();
    this.#setupEventListeners();

  }

  // Constructor related methods
  // --------------------------------------------------------------

  async init() {
    // any async initialization can go here
    return this.getStateFromBackend()
    .then((state) => {
      if (state) {
        this.state = state;
        this.previousStates.push(state);
        this.updateWidgets();
      }
    })
    .catch((error) => {
      console.error("Error initializing app state:", error);
      showError("Failed to initialize application state");
    });
  
  }

  // Constructor and initialization methods
  #setupChoreManagers() {
    // Create chore managers with app reference
    this.widgets = [];
    Array.from(document.querySelectorAll(".user-card[data-user]")).forEach(
      (card) => this.widgets.push(new ChoreManager(card, this))
    );
  }

  #setupEventListeners() {
    // event for reset button
    const buttonReset = document.getElementById("reset-tasks");
    const buttonEndWeek = document.getElementById("end-week-tasks");
    this.buttonUndo = document.getElementById("undo-tasks");

    buttonReset.addEventListener("click", async () => {
      console.log('clicked button reset');
      
      await this.resetState();
      console.log('state reset, updating widgets');
      console.log(this.state);
      
      this.updateWidgets();
    });

    buttonEndWeek.addEventListener("click", async () => {
      await handleEndWeek();
    });

    this.buttonUndo.addEventListener("click", () => {
      this.undoLastChange();
    });
  }

  // Updates app state from the backend
  async getStateFromBackend() {
    return fetch("/api/state")
      .then((response) => response.json())
      .then((result) => {
        if (!result.success) {
          console.warn("Failed to fetch state:", result.error);
          showError("Failed to fetch state: " + result.error);
          return null;
        }
        return result.data;
      })
      .catch((error) => {
        console.error("Error fetching state:", error);
        return null;
      });
  }

  // General Runtime state management methods
  // --------------------------------------------------------------


  getState() {
    // return the app state
    return JSON.parse(JSON.stringify(this.state));
  }

  async setState(newState, isUndo=false) {
    // sets new app state and saves it through the backend API
    // isUndo indicates if this is an undo operation

    
    return fetch("/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newState),
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
      })
      .then(() => {
        this.state = newState;
        if (!isUndo) {
          // Store previous state for undo functionality
          this.previousStates.push(this.getState());
          this.buttonUndo.disabled = false;
          if (this.previousStates.length > 3) {
            this.previousStates.shift(); // Keep only last 3 states
          }
        }
      });
  }

  updateWidgets() {
    // Update all widgets from app state

    if (!this.state) {
      console.log("updateWidgets -> No application state set for update");
      return;
    }
    console.log(this.state);
    
    this.widgets.forEach((widget) => widget.updateFromAppState());
  }

  async setStateAndUpdateWidgets(state, isUndo=false) {
    // set new state and update all widgets
    return this.setState(state, isUndo).then(() => this.updateWidgets());
  }
  
  // Specific operations
  // --------------------------------------------------------------

  async resetState() {
    // reset state, this is both persisted via the backend API and
    // updated in the app state itself
    return fetch("/api/reset", {
      method: "POST",
    })
      .then((response) => response.json())
      .then((result) => {
        if (!result.success) {
          console.warning("Failed to reset state:", result.error);
          showError("Failed to reset state: " + result.error);
          throw new Error(result.error);
        }
        else {
          return this.setState(result.data)
            .then(() => true);
        }
      })
      .catch((error) => {
        console.error("Error resetting state:", error);
        throw error;
      });
  }

  async undoLastChange() {
    if (this.previousStates.length <= 1) {
      showWarning("No previous state to undo to.", "Undo");
      return;
    }
    this.previousStates.pop();
    const lastState = this.previousStates[this.previousStates.length - 1];

    await this.setState(lastState, true);
    await this.updateWidgets();
    this.buttonUndo.disabled = this.previousStates.length <= 1;
  }
}

  // Handle end of week functionality
async function handleEndWeek() {
  try {
    // Here you can implement week ending logic like:
    // - Save current week's progress
    // - Archive completed tasks
    // - Generate weekly report
    // - Reset for new week
    showSuccess("Week ended successfully! Progress saved.", "End of Week");

    // For now, just show a success message
    // You can expand this functionality later
  } catch (error) {
    console.error("Error ending week:", error);
    showError("Failed to end week. Please try again.", "Error");
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
const app = new App();
await app.init();

window.globalThis.app = app; // expose app for debugging purposes