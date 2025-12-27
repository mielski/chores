import { showSuccess, showError, showWarning, showInfo } from "./ui-toast.js";
import { verifyPasscodeWithPrompt } from "./ui-security.js";

function getDisplayDate(date) {
  // Format a date into a string using the following logic:
  //
  // - If today, return "vandaag"
  // - If yesterday, return "gisteren"
  // - Else, return in "DD MMM" format according to user's locale

  // first take the beginning of day
  const dateBeginningDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  // then compare to whether day is in today and yesterday 
  const today = new Date();
  const isToday = dateBeginningDay.getTime() + 3600_000 * 24 > today.valueOf();
  if (isToday) return "vandaag"

  const isYesterday =
    dateBeginningDay.getTime() + 3600_000 * 48 > today.valueOf() && !isToday;

  if (isYesterday) return "gisteren"

  // else return formatted date
  return dateBeginningDay.toLocaleDateString(
    window.navigator.language,
    {
      day: "numeric",
      month: "short",
    }
  );



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
    // creates a new chore from the input elements
    // updates the app state through the app reference
    const choreName = this.elements.nameInput.value.trim();
    const choreDateString = new Date().toISOString().slice(0, 10); // current date in ISO format
    if (!choreName) {
      return; // ignore empty input
    }
    console.log(`${this.user} selected ${choreName}`);

    // Add chore and save through app
    this.currentChores.push({ name: choreName, date: choreDateString });

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
        Nog geen taakjes deze wek
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
          const displayDate = getDisplayDate(choreDate);

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
    this.previousStates = []; // stores the last 3 previous states for undo operations
    this.state = null; // current application state
    this.onStateChanged = null; // optional callback for state change listeners
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

    // events for buttons in the task toolbar
    const buttonReset = document.getElementById("reset-tasks");
    const buttonEndWeek = document.getElementById("end-week-tasks");
    this.buttonUndo = document.getElementById("undo-tasks");

    buttonReset.addEventListener("click", async () => {
      console.log("clicked button reset");

      await this.resetState();
      console.log("state reset, updating widgets");
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

  async setState(newState, isUndo = false) {
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
        if (typeof this.onStateChanged === "function") {
          try {
            this.onStateChanged(this.getState());
          } catch (e) {
            console.error("Error in onStateChanged callback", e);
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

  async setStateAndUpdateWidgets(state, isUndo = false) {
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
        } else {
          return this.setState(result.data).then(() => true);
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

// Allowance UI manager
class AllowanceManager {
  // Manages allowance card for a single user
  constructor(cardElement, app) {
    this.card = cardElement;
    this.userId = cardElement.dataset.user;
    this.app = app;

    this.account = null;
    this.transactions = [];

    this.elements = {
      balance: this.card.querySelector(".allowance-card__balance"),
      currency: this.card.querySelector(".allowance-card__currency"),
      weeklyBase: this.card.querySelector(".allowance-card__weekly-base"),
      weeklyBonus: this.card.querySelector(".allowance-card__weekly-bonus"),
      weeklyTotal: this.card.querySelector(".allowance-card__weekly-total"),
      txList: this.card.querySelector(".allowance-card__transactions-list"),
      addButton: this.card.querySelector(".allowance-card__add-transaction"),
      undoButton: this.card.querySelector(".allowance-card__undo-transaction"),
    };

    this.#setupEvents();
  }

  async init() {
    await this.refreshFromServer();
    const state = this.app.getState();
    if (state && state[this.userId]) {
      this.updateFromAppState(state);
    }
  }

  #setupEvents() {
    // Setup event listeners for add and undo buttons
    this.elements.addButton.addEventListener("click", async () => {
      const ok = await verifyPasscodeWithPrompt();
      if (!ok) {
        return;
      }
      this.#openTransactionModal();
    });

    this.elements.undoButton.addEventListener("click", async () => {
      const ok = await verifyPasscodeWithPrompt();
      if (!ok) {
        return;
      }
      await this.#undoLastTransaction();
    });
  }

  async refreshFromServer() {
    // Fetch latest account and transactions from server and update UI
    try {
      const [accountRes, txRes] = await Promise.all([
        fetch(`/api/allowance/${encodeURIComponent(this.userId)}/account`),
        fetch(
          `/api/allowance/${encodeURIComponent(
            this.userId
          )}/transactions?limit=5`
        ),
      ]);

      const accountJson = await accountRes.json();
      if (accountRes.ok && accountJson.success) {
        this.account = accountJson.data;
      }

      const txJson = await txRes.json();
      if (txRes.ok && txJson.success) {
        this.transactions = txJson.transactions || [];
      } else {
        this.transactions = [];
      }

      this.#renderAccount();
      this.#renderTransactions();
    } catch (error) {
      console.error("Error loading allowance data", error);
      showError("Kon spaargegevens niet laden.");
    }
  }

  updateFromAppState(state) {
    const userData = state?.[this.userId];
    if (!userData || !this.account) {
      return;
    }

    const settings = this.account.settings || userData.settings || {};
    const weeklyAllowance = Number(settings.weeklyAllowance || 0);
    const tasksPerWeek = Number(settings.tasksPerWeek || 0);
    const bonusPerExtraTask = Number(settings.bonusPerExtraTask || 0);
    const maximumExtraTasks = Number(settings.maximumExtraTasks || 0);

    const choresCompleted = Array.isArray(userData.choreList)
      ? userData.choreList.length
      : 0;

    const extraTasksRaw = choresCompleted - tasksPerWeek;
    const extraTasks = Math.max(0, Math.min(extraTasksRaw, maximumExtraTasks));
    const bonus = extraTasks * bonusPerExtraTask;
    const total = weeklyAllowance + bonus;

    this.elements.weeklyBase.textContent =
      this.#formatCurrency(weeklyAllowance);
    this.elements.weeklyBonus.textContent = this.#formatCurrency(bonus);
    this.elements.weeklyTotal.textContent = this.#formatCurrency(total);
  }

  #renderAccount() {
    if (!this.account) return;
    const balance = Number(this.account.currentBalance || 0);
    const currency = this.account.currency || "EUR";

    this.elements.balance.textContent = this.#formatCurrency(balance);
    if (this.elements.currency) {
      this.elements.currency.textContent = currency;
    }
  }

  #renderTransactions() {
    const list = this.elements.txList;
    if (!list) return;

    list.innerHTML = "";

    if (!this.transactions || this.transactions.length === 0) {
      const li = document.createElement("li");
      li.className = "small text-muted fst-italic";
      li.textContent = "Nog geen transacties";
      list.appendChild(li);
      return;
    }

    this.transactions.forEach((tx) => {
      const li = document.createElement("li");
      li.className = "d-flex justify-content-between small";

      const amount = Number(tx.amount || 0);
      const directionClass =
        amount >= 0 ? "amount-positive" : "amount-negative";

      const date = tx.timestamp ? new Date(tx.timestamp) : null;
      const displayDate = date ? getDisplayDate(date) : "";

      const description = tx.description || tx.type || "Transactie";

      li.innerHTML = `
        <span>
          <span class="${directionClass}">${this.#formatCurrency(amount)}</span>
          &middot;
          <span>${description}</span>
        </span>
        <span class="text-muted">
          <time datetime="${tx.timestamp || ""}">${displayDate}</time>
        </span>
      `;

      list.appendChild(li);
    });
  }

  #openTransactionModal() {
    const modalEl = document.getElementById("transactionModal");
    if (!modalEl) return;

    const userInput = document.getElementById("transaction-user-id");
    const amountInput = document.getElementById("transaction-amount");
    const typeSelect = document.getElementById("transaction-type");
    const descInput = document.getElementById("transaction-description");

    userInput.value = this.userId;
    amountInput.value = "";
    typeSelect.value = "MANUAL";
    descInput.value = "";

    const modal = new bootstrap.Modal(modalEl);
    modal.show();
  }

  async #undoLastTransaction() {
    try {
      const res = await fetch(
        `/api/allowance/${encodeURIComponent(this.userId)}/transactions/last`,
        { method: "DELETE" }
      );
      const json = await res.json();

      if (!res.ok || !json.success) {
        showWarning(
          json.error || "Kon laatste transactie niet ongedaan maken."
        );
        return;
      }

      this.account = json.account;
      await this.refreshFromServer();
      showSuccess("Laatste transactie is ongedaan gemaakt.");
    } catch (e) {
      console.error("Error undoing last transaction", e);
      showError("Er ging iets mis bij het ongedaan maken.");
    }
  }

  async saveTransactionFromModal() {
    const userInput = document.getElementById("transaction-user-id");
    const amountInput = document.getElementById("transaction-amount");
    const typeSelect = document.getElementById("transaction-type");
    const descInput = document.getElementById("transaction-description");

    const amount = Number(amountInput.value);
    if (!userInput.value || Number.isNaN(amount) || amount === 0) {
      showWarning("Vul een bedrag in om op te slaan.");
      return;
    }

    const payload = {
      amount,
      type: typeSelect.value,
      description: descInput.value || null,
    };

    try {
      const res = await fetch(
        `/api/allowance/${encodeURIComponent(this.userId)}/transactions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const json = await res.json();

      if (!res.ok || !json.success) {
        showError(json.error || "Kon transactie niet opslaan.");
        return;
      }

      this.account = json.account;
      await this.refreshFromServer();
      showSuccess("Transactie opgeslagen.");
    } catch (e) {
      console.error("Error saving transaction", e);
      showError("Er ging iets mis bij het opslaan van de transactie.");
    }
  }

  #formatCurrency(value) {
    const number = Number(value || 0);
    try {
      return new Intl.NumberFormat(window.navigator.language, {
        style: "currency",
        currency: this.account?.currency || "EUR",
        minimumFractionDigits: 2,
      }).format(number);
    } catch {
      return `€ ${number.toFixed(2)}`;
    }
  }
}

// Initialize the application
const app = new App();
await app.init();

window.globalThis.app = app; // expose app for debugging purposes

// Initialize allowance managers
const allowanceCards = Array.from(
  document.querySelectorAll(".allowance-card[data-user]")
);

const allowanceManagers = allowanceCards.map(
  (card) => new AllowanceManager(card, app)
);

window.globalThis.allowanceManagers = allowanceManagers;

for (const manager of allowanceManagers) {
  await manager.init();
}

// Update weekly allowance/bonus whenever app state changes
app.onStateChanged = (state) => {
  allowanceManagers.forEach((m) => m.updateFromAppState(state));
};

// Allowance view filter (Alle / Milou / Luca)
function applyAllowanceViewFilter(view) {
  allowanceCards.forEach((card) => {
    const user = card.dataset.user;
    if (!view || view === "all" || user === view) {
      card.style.display = "";
    } else {
      card.style.display = "none";
    }
  });
}

const viewDropdownButton = document.getElementById("allowance-view-dropdown");
const viewItems = document.querySelectorAll("[data-allowance-view]");

viewItems.forEach((item) => {
  item.addEventListener("click", async () => {
    const ok = await verifyPasscodeWithPrompt();
    if (!ok) {
      return;
    }
    const view = item.dataset.allowanceView;
    if (viewDropdownButton) {
      viewDropdownButton.textContent = item.textContent.trim();
    }
    applyAllowanceViewFilter(view);
  });
});

// Default view: show all
applyAllowanceViewFilter("all");

// Wire up toolbar process button (design-only for now)
const processButton = document.querySelector(".allowance-toolbar__process");
if (processButton) {
  processButton.addEventListener("click", () => {
    showInfo("Week verwerken komt binnenkort beschikbaar.");
  });
}

// Wire up modal save button to active allowance manager
const saveTxButton = document.getElementById("save-transaction");
if (saveTxButton) {
  saveTxButton.addEventListener("click", async () => {
    const userInput = document.getElementById("transaction-user-id");
    const userId = userInput?.value;
    const manager = allowanceManagers.find((m) => m.userId === userId);
    if (!manager) {
      showError("Geen gebruiker gevonden voor deze transactie.");
      return;
    }
    await manager.saveTransactionFromModal();

    const modalEl = document.getElementById("transactionModal");
    if (modalEl) {
      const modal =
        bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
      modal.hide();
    }
  });
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



