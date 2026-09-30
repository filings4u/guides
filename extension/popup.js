const $ = selector => document.querySelector(selector);

async function call(message) {
  return chrome.runtime.sendMessage(message);
}

function showMessage(text, error = false) {
  const box = $("#message");
  box.hidden = !text;
  box.textContent = text || "";
  box.className = "status " + (error ? "bad" : "");
}

async function render() {
  const [authResponse, stateResponse] = await Promise.all([
    call({ type: "AUTH_STATUS" }),
    call({ type: "GET_STATE" })
  ]);

  const signedIn = !!authResponse?.signed_in;
  const state = stateResponse?.state || {};

  $("#loginView").hidden = signedIn;
  $("#recorderView").hidden = !signedIn;

  if (!signedIn) return;

  $("#accountEmail").textContent =
    authResponse.user?.email || "Signed in";

  const hasGuide = !!state.guide;

  $("#newGuideView").hidden = hasGuide;
  $("#activeView").hidden = !hasGuide;

  if (!hasGuide) return;

  $("#recordingStatus").textContent =
    state.recording
      ? "● Recording"
      : "● Recording finished";

  $("#recordingStatus").className =
    state.recording ? "ok" : "";

  $("#count").textContent =
    (state.steps?.length || 0) + " steps saved";

  $("#saveStatus").textContent =
    state.saving
      ? "Saving…"
      : (state.last_error || "Saved to Guide Builder");

  $("#saveStatus").className =
    state.last_error ? "bad" : "";

  $("#stop").hidden = !state.recording;
}

$("#signIn").onclick = async () => {
  showMessage("");

  const email = $("#email").value.trim();
  const password = $("#password").value;

  if (!email || !password) {
    showMessage("Enter your email and password.", true);
    return;
  }

  const response = await call({
    type: "SIGN_IN",
    email,
    password
  });

  if (!response?.ok) {
    showMessage(
      response?.error || "Unable to sign in.",
      true
    );
    return;
  }

  $("#password").value = "";
  await render();
};

$("#signOut").onclick = async () => {
  await call({ type: "SIGN_OUT" });
  showMessage("");
  await render();
};

$("#start").onclick = async () => {
  showMessage("");

  const title = $("#title").value.trim();

  if (!title) {
    showMessage("Enter a guide title.", true);
    return;
  }

  const response = await call({
    type: "START_RECORDING",
    title,
    portal: $("#portal").value,
    audience: "Customer"
  });

  if (!response?.ok) {
    showMessage(
      response?.error || "Could not start recording.",
      true
    );
    return;
  }

  await render();
};

$("#stop").onclick = async () => {
  showMessage("");

  const response = await call({
    type: "STOP_RECORDING"
  });

  if (!response?.ok) {
    showMessage(
      response?.error || "Could not finish recording.",
      true
    );
  }

  await render();
};

$("#openGuide").onclick = async () => {
  showMessage("");

  const response = await call({
    type: "OPEN_GUIDE"
  });

  if (!response?.ok) {
    showMessage(
      response?.error || "Could not open the guide.",
      true
    );
  }
};

$("#clear").onclick = async () => {
  await call({ type: "CLEAR_RECORDING" });
  showMessage("");
  await render();
};

render().catch(error => {
  showMessage(
    error?.message || "Recorder could not load.",
    true
  );
});