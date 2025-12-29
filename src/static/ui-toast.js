// Toast notification utilities

export function showToast(
  message,
  type = "info",
  title = null,
  duration = 5000
) {
  const toast = document.getElementById("notification-toast");
  const toastIcon = document.getElementById("toast-icon");
  const toastTitle = document.getElementById("toast-title");
  const toastMessage = document.getElementById("toast-message");

  if (!toast || !toastIcon || !toastTitle || !toastMessage) {
    console.warn("Toast container elements not found in DOM.");
    return;
  }

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

  toastIcon.className = `fas ${config.icon} ${config.color} me-2`;
  toastTitle.textContent = title || config.title;
  toastMessage.textContent = message;

  const bsToast = new bootstrap.Toast(toast, {
    delay: duration,
  });
  bsToast.show();
}

export function showSuccess(message, title = null) {
  showToast(message, "success", title);
}

export function showError(message, title = null) {
  showToast(message, "error", title);
}

export function showWarning(message, title = null) {
  showToast(message, "warning", title);
}

export function showInfo(message, title = null) {
  showToast(message, "info", title);
}

// Optional: expose for debugging in the console
if (typeof window !== "undefined") {
  window.showToast = showToast;
  window.showSuccess = showSuccess;
  window.showError = showError;
  window.showWarning = showWarning;
  window.showInfo = showInfo;
}
