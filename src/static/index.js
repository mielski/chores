// project configuration constants
"use strict";

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
      if (progress === "100%") {celebrationBurst()};
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



// Initialize app configuration and then generate table
async function initializeApp() {
  console.log("Initializing app, current config:", currentConfig);

  await loadAppConfig();
  console.log("App config after loading:", currentConfig);
  setupProgressBars();
  generateTaskTable();
  setupEventListeners();
  updateApp();
}

// Load configuration from API
async function loadAppConfig() {
  // wait for the configuration to be ready
  // log errors and use fallback if needed
  // do not block the caller, so no await or return here!
  try {
    const result = await configReady;
    console.log("promise result:", result);
  } catch (error) {
    console.error("Error loading configuration:", error);
  }
}
/* High level functions of the app */

// setup of the initial table
function generateTaskTable() {
  // run once on page load to create the tasks from the configuration
  // and remove the template row

  const tableBody = document.querySelector("tbody");
  const tableTemplateRow = tableBody.lastElementChild;

  function addRow(taskname) {
    const row = tableTemplateRow.cloneNode(true);
    row.firstElementChild.textContent = taskname;
    tableBody.appendChild(row);
  }

  // Add general tasks first
  currentConfig.generalTasks.forEach((taskName) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td scope="row">${taskName}</td>
      <td><button class="btn btn-outline-primary general-task" autocomplete="off">...</button></td>
      <td><button class="btn btn-outline-primary general-task" autocomplete="off">...</button></td>
      <td><button class="btn btn-outline-primary general-task" autocomplete="off">...</button></td>
      <td><button class="btn btn-outline-primary general-task" autocomplete="off">...</button></td>
      <td><button class="btn btn-outline-primary general-task" autocomplete="off">...</button></td>
      <td><button class="btn btn-outline-primary general-task" autocomplete="off">...</button></td>
      <td><button class="btn btn-outline-primary general-task" autocomplete="off">...</button></td>
    `;
    tableBody.insertBefore(row, tableTemplateRow);
  });

  // Add personal tasks
  currentConfig.personalTasks.forEach((taskName) => {
    addRow(taskName);
  });

  tableTemplateRow.remove(); // remove the template element

  // Update CSS colors for users
  _updateUserColors();
}

function _updateUserColors() {
  // Create dynamic CSS for user colors
  const style = document.createElement("style");
  let css = "";

  for (const [userId, userConfig] of Object.entries(currentConfig.users)) {
    css += `
      #progress-${userId} {
        background-color: ${userConfig.color} !important;
      }
      .btn-${userId} {
        border-color: ${userConfig.color};
        color: ${userConfig.color};
      }
      .btn-${userId}.active {
        background-color: ${userConfig.color};
        border-color: ${userConfig.color};
      }
      .btn-${userId}:hover {
        background-color: ${userConfig.color};
      }
    `;
  }

  style.innerHTML = css;
  document.head.appendChild(style);

  // Update progress bar labels
  for (const [userId, userConfig] of Object.entries(currentConfig.users)) {
    const label =
      window.progressBars[userId].progressBar?.parentElement
        ?.previousElementSibling;
    if (label) label.textContent = userConfig.displayName;
  }
}

function setupProgressBars() {
  // Create progress bars for each user
  window.progressBars = {};
    for (const [userId, userConfig] of Object.entries(currentConfig.users)) {
    const progressElement = document.getElementById(`progress-${userId}`);
    if (progressElement) {
      window.progressBars[userId] = new ProgressBar(
        progressElement,
        userConfig.tasksPerWeek
      );
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
  }
  catch (error) {
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

// Initialize the application
initializeApp();
