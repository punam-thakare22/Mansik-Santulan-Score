/* =========================================================
   Mental Health Prediction — script.js
   Handles: navigation, multi-step form, validation,
   API communication, loading/error/result states.
   ========================================================= */

/* ---------------------------------------------------------
   0. Configuration
   --------------------------------------------------------- */

// Change this single value if the FastAPI backend runs elsewhere.
const API_URL = "http://127.0.0.1:8000";

// Configurable score interpretation. Adjust freely once the
// real meaning of the model's output scale is known.
// "max" defines the upper bound used to fill the gauge (0–max).
const SCORE_SCALE_MAX = 10;

const SCORE_RANGES = [
  { upTo: 3.5,  label: "Lower predicted score",  color: "#C97B63",
    note: "The model's prediction for your inputs sits toward the lower end of its scale." },
  { upTo: 6.5,  label: "Mid-range predicted score", color: "#8B7FD1",
    note: "The model's prediction for your inputs sits in the middle of its scale." },
  { upTo: Infinity, label: "Higher predicted score", color: "#4C7A6D",
    note: "The model's prediction for your inputs sits toward the higher end of its scale." }
];

/* ---------------------------------------------------------
   1. Navigation (mobile menu, scroll fade-ins)
   --------------------------------------------------------- */

const navToggle = document.getElementById("navToggle");
const mainNav = document.getElementById("main-nav");

navToggle.addEventListener("click", () => {
  const isOpen = mainNav.classList.toggle("open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
});

mainNav.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    mainNav.classList.remove("open");
    navToggle.setAttribute("aria-expanded", "false");
  });
});

document.querySelectorAll(".predict-section").forEach((section) => {
  section.classList.add("fade-section");
});

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in-view");
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 }
);

document.querySelectorAll(".fade-section").forEach((el) => observer.observe(el));

/* ---------------------------------------------------------
   2. Segmented control — perceived stress level
   --------------------------------------------------------- */

const stressSegmented = document.getElementById("stressSegmented");
const stressHiddenInput = document.getElementById("stress_level");

stressSegmented.querySelectorAll(".segmented-option").forEach((option) => {
  option.addEventListener("click", () => {
    stressSegmented.querySelectorAll(".segmented-option").forEach((o) => {
      o.classList.remove("selected");
      o.setAttribute("aria-checked", "false");
    });
    option.classList.add("selected");
    option.setAttribute("aria-checked", "true");
    stressHiddenInput.value = option.dataset.value;
    clearError("stress_level");
  });
});

/* ---------------------------------------------------------
   4. Form reference
   --------------------------------------------------------- */

const form = document.getElementById("predictForm");

/* ---------------------------------------------------------
   5. Validation
   --------------------------------------------------------- */

const ALL_FIELDS = [
  "age", "gender", "country", "academic_level", "most_used_platform",
  "purpose_of_use", "avg_daily_usage_hours", "daily_unlocks",
  "study_hours", "physical_activity_hours", "sleep_hours_per_night",
  "stress_level"
];

function setError(field, message) {
  const el = document.getElementById(`err-${field}`);
  if (el) el.textContent = message;
}

function clearError(field) {
  setError(field, "");
}

function validateForm() {
  let valid = true;
  ALL_FIELDS.forEach((field) => clearError(field));

  const age = document.getElementById("age").value;
  if (!age || Number(age) < 10 || Number(age) > 100) {
    setError("age", "Enter an age between 10 and 100.");
    valid = false;
  }

  if (!document.getElementById("gender").value) {
    setError("gender", "Please select a gender.");
    valid = false;
  }

  if (!document.getElementById("country").value) {
    setError("country", "Please select a country.");
    valid = false;
  }

  if (!document.getElementById("academic_level").value) {
    setError("academic_level", "Please select an academic level.");
    valid = false;
  }

  if (!document.getElementById("most_used_platform").value) {
    setError("most_used_platform", "Please select a platform.");
    valid = false;
  }

  if (!document.getElementById("purpose_of_use").value) {
    setError("purpose_of_use", "Please select a purpose.");
    valid = false;
  }

  const usage = document.getElementById("avg_daily_usage_hours").value;
  if (usage === "" || Number(usage) < 0 || Number(usage) > 24) {
    setError("avg_daily_usage_hours", "Enter a value between 0 and 24.");
    valid = false;
  }

  const unlocks = document.getElementById("daily_unlocks").value;
  if (unlocks === "" || Number(unlocks) < 0) {
    setError("daily_unlocks", "Enter a value of 0 or more.");
    valid = false;
  }

  const study = document.getElementById("study_hours").value;
  if (study === "" || Number(study) < 0 || Number(study) > 24) {
    setError("study_hours", "Enter a value between 0 and 24.");
    valid = false;
  }

  const activity = document.getElementById("physical_activity_hours").value;
  if (activity === "" || Number(activity) < 0 || Number(activity) > 24) {
    setError("physical_activity_hours", "Enter a value between 0 and 24.");
    valid = false;
  }

  const sleep = document.getElementById("sleep_hours_per_night").value;
  if (sleep === "" || Number(sleep) < 0 || Number(sleep) > 24) {
    setError("sleep_hours_per_night", "Enter a value between 0 and 24.");
    valid = false;
  }

  if (!stressHiddenInput.value) {
    setError("stress_level", "Please select a stress level.");
    valid = false;
  }

  if (!valid) {
    const firstError = document.querySelector(".field-error:not(:empty)");
    if (firstError) firstError.closest(".field, .field-wide").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return valid;
}

/* ---------------------------------------------------------
   6. UI state helpers
   --------------------------------------------------------- */

const formCard = document.querySelector(".form-card");
const loadingState = document.getElementById("loadingState");
const errorCard = document.getElementById("errorCard");
const errorMessage = document.getElementById("errorMessage");
const resultCard = document.getElementById("resultCard");
const submitBtn = document.getElementById("submitBtn");

function showLoading() {
  form.hidden = true;
  errorCard.hidden = true;
  resultCard.hidden = true;
  loadingState.hidden = false;
}

function showForm() {
  form.hidden = false;
  loadingState.hidden = true;
  errorCard.hidden = true;
  resultCard.hidden = true;
}

function showError(message) {
  loadingState.hidden = true;
  resultCard.hidden = true;
  form.hidden = true;
  errorCard.hidden = false;
  errorMessage.textContent = message;
}

function showResult(score) {
  loadingState.hidden = true;
  errorCard.hidden = true;
  form.hidden = true;
  resultCard.hidden = false;
  renderResult(score);
}

document.getElementById("errorDismiss").addEventListener("click", () => {
  showForm();
});

/* ---------------------------------------------------------
   7. Result rendering (animated counter + gauge)
   --------------------------------------------------------- */

const scoreValueEl = document.getElementById("scoreValue");
const gaugeFillEl = document.getElementById("gaugeFill");
const resultNoteEl = document.getElementById("resultNote");
const resultTagEl = document.getElementById("resultTag");

const GAUGE_PATH_LENGTH = 251; // approximate length of the arc path

function renderResult(score) {
  const clamped = Math.max(0, Math.min(score, SCORE_SCALE_MAX));
  const range = SCORE_RANGES.find((r) => clamped <= r.upTo);

  // Animate the counter
  const duration = 900;
  const start = performance.now();

  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    scoreValueEl.textContent = (clamped * eased).toFixed(2);
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // Animate the gauge
  const fillRatio = clamped / SCORE_SCALE_MAX;
  const offset = GAUGE_PATH_LENGTH * (1 - fillRatio);
  gaugeFillEl.style.stroke = range.color;
  requestAnimationFrame(() => {
    gaugeFillEl.style.strokeDashoffset = String(offset);
  });

  resultTagEl.textContent = `Predicted Score \u2022 ${range.label}`;
  resultNoteEl.textContent = range.note;
}

/* ---------------------------------------------------------
   8. Submit — API integration
   --------------------------------------------------------- */

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!validateForm()) return;

  const payload = {
    age: parseInt(document.getElementById("age").value, 10),
    gender: document.getElementById("gender").value,
    country: document.getElementById("country").value,
    academic_level: document.getElementById("academic_level").value,
    most_used_platform: document.getElementById("most_used_platform").value,
    purpose_of_use: document.getElementById("purpose_of_use").value,
    avg_daily_usage_hours: parseFloat(document.getElementById("avg_daily_usage_hours").value),
    daily_unlocks: parseInt(document.getElementById("daily_unlocks").value, 10),
    study_hours: parseFloat(document.getElementById("study_hours").value),
    physical_activity_hours: parseFloat(document.getElementById("physical_activity_hours").value),
    sleep_hours_per_night: parseFloat(document.getElementById("sleep_hours_per_night").value),
    stress_level: document.getElementById("stress_level").value
  };

  submitBtn.disabled = true;
  showLoading();

  try {
    const response = await fetch(`${API_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (response.status === 422) {
      const errorBody = await response.json();
      showError(formatValidationError(errorBody));
      submitBtn.disabled = false;
      return;
    }

    if (!response.ok) {
      showError(`The prediction server responded with an error (status ${response.status}). Please try again.`);
      submitBtn.disabled = false;
      return;
    }

    const data = await response.json();

    if (typeof data.predicted_mental_health_score !== "number") {
      showError("The prediction server returned an unexpected response.");
      submitBtn.disabled = false;
      return;
    }

    showResult(data.predicted_mental_health_score);
  } catch (err) {
    showError("Unable to connect to the prediction server. Please make sure the FastAPI backend is running.");
  } finally {
    submitBtn.disabled = false;
  }
});

function formatValidationError(errorBody) {
  if (!errorBody || !Array.isArray(errorBody.detail)) {
    return "The server could not validate your submission. Please check your inputs and try again.";
  }

  const messages = errorBody.detail.map((item) => {
    const field = Array.isArray(item.loc) ? item.loc[item.loc.length - 1] : "field";
    return `${field}: ${item.msg}`;
  });

  return `Please check the following: ${messages.join(" \u2022 ")}`;
}

/* ---------------------------------------------------------
   9. Result actions — predict again / back to form
   --------------------------------------------------------- */

document.getElementById("predictAgainBtn").addEventListener("click", () => {
  showForm();
  document.getElementById("predict").scrollIntoView({ behavior: "smooth", block: "start" });
});

document.getElementById("backToFormBtn").addEventListener("click", () => {
  showForm();
});
