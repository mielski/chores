// project configuration constants
"use strict";

const complimentjes = [
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
const personalTaskNames = [
  "Vaatwasser inruimen",
  "Vaatwasser uitruimen",
  "Koken",
  "Vuilnis/Papier wegbrengen",
  "Kamer opruimen",
  "Overig",
  "Joker",
];
const totalTasksRequired = 7;

/* High level functions of the app */

// setup of the initial table
function generateTaskTable() {
  // run once on page load to create the tasks from the array personalTaskNames
  // and remove the template row

  const tableBody = document.querySelector("tbody");
  const tableTemplateRow = tableBody.lastElementChild;

  function addRow(taskname) {
    const row = tableTemplateRow.cloneNode(true);

    row.firstElementChild.textContent = taskname;
    tableBody.appendChild(row);
  }
  personalTaskNames.forEach((taskName) => {
    addRow(taskName);
  });
  tableTemplateRow.remove(); // remove the template element
}
generateTaskTable();

// setup of the flow

// references to progress bars and buttons used in functions
const progressBarLuca = document.getElementById("progress-luca");
const progressBarMilou = document.getElementById("progress-milou");
const taskButtonsMilou = document.querySelectorAll("table .btn-milou");
const taskButtonsLuca = document.querySelectorAll("table .btn-luca");
const taskButtonsGeneral = document.querySelectorAll("table .general-task");
const buttonReset = document.getElementById("reset");

const progressLuca = {
  progressBar: progressBarLuca,
  done: 0,
  required: totalTasksRequired,
  timeoutId: undefined,
  updateProgress: function (giveCompliment = false) {
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
    } else {
      this.progressBar.innerText = progress;
    }
  },
};

const progressMilou = {
  progressBar: progressBarMilou,
  done: 0,
  required: totalTasksRequired,
  timeoutId: undefined,
  updateProgress: function (giveCompliment = false) {
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
    } else {
      this.progressBar.innerText = progress;
    }
  },
};

async function storeState(reset = false) {
  // store state of the buttons to backend API
  // if reset=true stored false for all states in order to reset the app
  try {
    if (reset) {
      const response = await fetch("/api/reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const result = await response.json();
      if (!result.success) {
        console.error("Failed to reset state:", result.error);
      }
    } else {
      const isActive = (x) => x.classList.contains("active");
      const data = {
        milou: [...taskButtonsMilou].map(isActive),
        luca: [...taskButtonsLuca].map(isActive),
        general: [...taskButtonsGeneral].map(isActive),
      };

      const response = await fetch("/api/state", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      if (!result.success) {
        console.error("Failed to save state:", result.error);
      }
    }
  } catch (error) {
    console.error("Error storing state:", error);
  }
}
async function updateApp() {
  // Load state from backend API
  try {
    const response = await fetch("/api/state");
    const result = await response.json();

    if (!result.success) {
      console.error("Failed to load state:", result.error);
      return;
    }

    const storedButtonStates = result.data;

    const dataTobuttonsMap = new Map([
      ["milou", taskButtonsMilou],
      ["luca", taskButtonsLuca],
      ["general", taskButtonsGeneral],
    ]);

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

    // iterate buttons and apply stored state
    for (let key in storedButtonStates) {
      applyStateToButtonList(
        dataTobuttonsMap.get(key),
        storedButtonStates[key]
      );
      console.log(key, storedButtonStates[key]);
    }

    // for the general buttons, do the conversion of the innerText manually
    taskButtonsGeneral.forEach((button) => {
      button.innerText = button.classList.contains("active") ? " 🎉 " : "...";
    });

    // restore the tasks done for Luca and Milou
    progressLuca.done = storedButtonStates["luca"].filter((x) => x).length;
    progressLuca.updateProgress();

    progressMilou.done = storedButtonStates["milou"].filter((x) => x).length;
    progressMilou.updateProgress();
  } catch (error) {
    console.error("Error loading state:", error);
    // Fallback to default state
    progressLuca.done = 0;
    progressLuca.updateProgress();
    progressMilou.done = 0;
    progressMilou.updateProgress();
  }
}

console.log(taskButtonsGeneral);

taskButtonsMilou.forEach((button) => {
  button.addEventListener("click", () => {
    let countChange = button.classList.contains("active") ? -1 : 1;
    button.classList.toggle("active");
    console.log(countChange);
    progressMilou.done += countChange;
    progressMilou.updateProgress(countChange === 1);
    storeState();
  });
});

taskButtonsLuca.forEach((button) => {
  button.addEventListener("click", () => {
    let countChange = button.classList.contains("active") ? -1 : 1;
    button.classList.toggle("active");
    console.log(countChange);
    progressLuca.done += countChange;
    progressLuca.updateProgress(countChange === 1);
    storeState();
  });
});

taskButtonsGeneral.forEach((button) => {
  button.addEventListener("click", () => {
    const isActive = button.classList.toggle("active");
    button.innerText = isActive ? " 🎉 " : "...";
    storeState();
  });
});

buttonReset.addEventListener("click", async () => {
  await storeState(true);
  await updateApp();
});

/*
Design overview, what kind of operations do I have

update single process bar from a button update

update all from reset button -> set all buttons and update both progress bars separately
update all from data load -> set all buttons and update both progress bars separately
*/
updateApp();
