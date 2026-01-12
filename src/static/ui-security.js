import { showError } from "./ui-toast.js";

// Simple passcode helper that shows a modal, verifies via API,
// and resolves to true/false so it can be used in guarded actions.
export async function verifyPasscodeWithPrompt() {
  const modalEl = document.getElementById("passcodeModal");

  // If no modal exists, treat verification as disabled/always true
  if (!modalEl) {
    return true;
  }

  const input = document.getElementById("passcode-input");
  const errorText = document.getElementById("passcode-error");
  const confirmBtn = document.getElementById("passcode-confirm");

  const modal = new bootstrap.Modal(modalEl);

  return new Promise((resolve) => {
    const resetUi = () => {
      if (input) {
        input.value = "";
      }
      if (errorText) {
        errorText.classList.add("d-none");
      }
    };

    const cleanup = () => {
      confirmBtn?.removeEventListener("click", onConfirm);
      modalEl.removeEventListener("hidden.bs.modal", onCancel);
      input?.removeEventListener("keypress", onKeyPress);
    };

    const onCancel = () => {
      cleanup();
      resolve(false);
    };

    const onKeyPress = (event) => {
      if (event.key === "Enter") {
        onConfirm();
      }
    };

    const onConfirm = async () => {
      if (!input) {
        cleanup();
        modal.hide();
        resolve(true);
        return;
      }

      const code = input.value.trim();
      if (!code) {
        if (errorText) {
          errorText.textContent = "Voer een code in.";
          errorText.classList.remove("d-none");
        }
        return;
      }

      try {
        const res = await fetch("/api/verify-passcode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });

        const json = await res.json();

        if (json.success && json.valid) {
          cleanup();
          modal.hide();
          // If backend has no passcode configured, verification always succeeds.
          if (json.configured === false) {
            console.info("No action passcode configured; verification automatically succeeds.");
          }
          resolve(true);
        } else if (!json.success) {
          console.error("Passcode verification failed", json.error);
          cleanup();
          modal.hide();
          showError(
            "Kon toegangscode niet controleren. Probeer het later opnieuw."
          );
          resolve(false);
        } else {
          if (errorText) {
            errorText.textContent = "Onjuiste code, probeer het opnieuw.";
            errorText.classList.remove("d-none");
          }
        }
      } catch (e) {
        console.error("Error verifying passcode", e);
        cleanup();
        modal.hide();
        showError("Er ging iets mis bij het controleren van de code.");
        resolve(false);
      }
    };

    resetUi();

    modalEl.addEventListener("hidden.bs.modal", onCancel);
    confirmBtn?.addEventListener("click", onConfirm);
    input?.addEventListener("keypress", onKeyPress);

    modal.show();
    setTimeout(() => input?.focus(), 150);
  });
}

// Optional: expose for debugging in the console
if (typeof window !== "undefined") {
  window.verifyPasscodeWithPrompt = verifyPasscodeWithPrompt;
}
