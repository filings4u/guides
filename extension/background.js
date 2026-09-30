const SUPABASE_URL = "https://elpbnytpciqnbexiaebp.supabase.co";
const SUPABASE_KEY = "sb_publishable_xVI6Mjkk1bNVMGHZCPuK6w_8FSHKdkC";
const GUIDE_API = SUPABASE_URL + "/functions/v1/guide-builder";

const STATE_KEY = "s4u_guide_recorder_state_v2";
const AUTH_KEY = "s4u_guide_recorder_auth_v1";

async function getState() {
  const data = await chrome.storage.local.get(STATE_KEY);
  return data[STATE_KEY] || {
    recording: false,
    guide: null,
    steps: [],
    saving: false,
    last_error: null
  };
}

async function setState(state) {
  await chrome.storage.local.set({ [STATE_KEY]: state });
}

async function getAuth() {
  const data = await chrome.storage.local.get(AUTH_KEY);
  return data[AUTH_KEY] || null;
}

async function setAuth(auth) {
  await chrome.storage.local.set({ [AUTH_KEY]: auth });
}

async function clearAuth() {
  await chrome.storage.local.remove(AUTH_KEY);
}

function authExpiresAt(result) {
  return Date.now() + Math.max(60, Number(result.expires_in || 3600) - 60) * 1000;
}

async function signIn(email, password) {
  const response = await fetch(SUPABASE_URL + "/auth/v1/token?grant_type=password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY
    },
    body: JSON.stringify({ email, password })
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok || !result.access_token) {
    throw new Error(
      result.error_description ||
      result.msg ||
      result.error ||
      "Unable to sign in."
    );
  }

  const auth = {
    access_token: result.access_token,
    refresh_token: result.refresh_token,
    expires_at: authExpiresAt(result),
    user: result.user ? {
      id: result.user.id,
      email: result.user.email
    } : null
  };

  await setAuth(auth);

  try {
    await guideApi({ action: "status" }, auth.access_token);
  } catch (error) {
    await clearAuth();
    throw error;
  }

  return auth;
}

async function refreshAuth(auth) {
  if (!auth?.refresh_token) {
    throw new Error("Guide Recorder sign-in is required.");
  }

  const response = await fetch(SUPABASE_URL + "/auth/v1/token?grant_type=refresh_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY
    },
    body: JSON.stringify({ refresh_token: auth.refresh_token })
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok || !result.access_token) {
    await clearAuth();
    throw new Error("Your Guide Recorder session expired. Sign in again.");
  }

  const updated = {
    access_token: result.access_token,
    refresh_token: result.refresh_token || auth.refresh_token,
    expires_at: authExpiresAt(result),
    user: result.user ? {
      id: result.user.id,
      email: result.user.email
    } : auth.user
  };

  await setAuth(updated);
  return updated;
}

async function getAccessToken() {
  let auth = await getAuth();

  if (!auth) {
    throw new Error("Sign in to the screenings4u Guide Recorder first.");
  }

  if (!auth.expires_at || Date.now() >= auth.expires_at) {
    auth = await refreshAuth(auth);
  }

  return auth.access_token;
}

async function guideApi(payload, token = null) {
  let jwt = token || await getAccessToken();

  const request = async currentToken => {
    return fetch(GUIDE_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: "Bearer " + currentToken
      },
      body: JSON.stringify(payload)
    });
  };

  let response = await request(jwt);

  if (response.status === 401 && !token) {
    const refreshed = await refreshAuth(await getAuth());
    jwt = refreshed.access_token;
    response = await request(jwt);
  }

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.error || "Guide Builder request failed.");
  }

  return result;
}

function normalizeStep(step, index) {
  return {
    id: step.id,
    step_number: index + 1,
    title: step.title || ("Step " + (index + 1)),
    instruction: step.instruction || "",
    page_url: step.url || null,
    page_title: step.page_title || null,
    clicked_element:
      step.element?.selector ||
      step.element?.label ||
      null,
    screenshot_path: step.screenshot_path || null,
    click_x: Number(step.click?.x_pct ?? 50),
    click_y: Number(step.click?.y_pct ?? 50),
    annotation_data: {},
    metadata: {
      element: step.element || {},
      captured_at: step.captured_at || null
    }
  };
}

async function saveGuide(state) {
  if (!state.guide) return null;

  state.saving = true;
  state.last_error = null;
  await setState(state);

  try {
    const result = await guideApi({
      action: "save_guide",
      create_version: false,
      guide: {
        id: state.guide.id,
        title: state.guide.title,
        portal_code: state.guide.portal,
        audience: state.guide.audience || "Customer",
        intro: state.guide.intro || "",
        status: "draft",
        steps: (state.steps || []).map(normalizeStep)
      }
    });

    state.guide = {
      ...state.guide,
      id: result.guide?.id || state.guide.id,
      version: result.guide?.version || state.guide.version
    };
    state.saving = false;
    state.last_error = null;
    await setState(state);
    return result.guide;
  } catch (error) {
    state.saving = false;
    state.last_error = error?.message || String(error);
    await setState(state);
    throw error;
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  const state = await getState();
  state.recording = false;
  state.saving = false;
  await setState(state);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message?.type === "AUTH_STATUS") {
      const auth = await getAuth();
      sendResponse({
        ok: true,
        signed_in: !!auth,
        user: auth?.user || null
      });
      return;
    }

    if (message?.type === "SIGN_IN") {
      const auth = await signIn(
        String(message.email || "").trim(),
        String(message.password || "")
      );
      sendResponse({ ok: true, user: auth.user });
      return;
    }

    if (message?.type === "SIGN_OUT") {
      await clearAuth();
      const state = await getState();
      state.recording = false;
      await setState(state);
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === "GET_STATE") {
      sendResponse({ ok: true, state: await getState() });
      return;
    }

    if (message?.type === "START_RECORDING") {
      await getAccessToken();

      const guide = {
        id: crypto.randomUUID(),
        title: String(message.title || "New Guide"),
        portal: String(message.portal || "ctpa-dot"),
        audience: String(message.audience || "Customer"),
        intro: "",
        created_at: new Date().toISOString()
      };

      const result = await guideApi({
        action: "save_guide",
        create_version: false,
        guide: {
          id: guide.id,
          title: guide.title,
          portal_code: guide.portal,
          audience: guide.audience,
          intro: "",
          status: "draft",
          steps: []
        }
      });

      const state = {
        recording: true,
        saving: false,
        last_error: null,
        guide: {
          ...guide,
          id: result.guide?.id || guide.id,
          version: result.guide?.version || 1
        },
        steps: []
      };

      await setState(state);
      sendResponse({ ok: true, state });
      return;
    }

    if (message?.type === "STOP_RECORDING") {
      const state = await getState();
      state.recording = false;
      await setState(state);
      await saveGuide(state);
      sendResponse({
        ok: true,
        state: await getState(),
        guide_id: state.guide?.id || null
      });
      return;
    }

    if (message?.type === "CLEAR_RECORDING") {
      const state = {
        recording: false,
        guide: null,
        steps: [],
        saving: false,
        last_error: null
      };
      await setState(state);
      sendResponse({ ok: true, state });
      return;
    }

    if (message?.type === "RECORD_CLICK") {
      const state = await getState();

      if (!state.recording || !state.guide?.id || !sender.tab?.id) {
        sendResponse({ ok: false, ignored: true });
        return;
      }

      let screenshot;

      try {
        screenshot = await chrome.tabs.captureVisibleTab(
          sender.tab.windowId,
          { format: "jpeg", quality: 90 }
        );
      } catch (error) {
        state.last_error =
          "Screenshot capture failed: " +
          (error?.message || String(error));
        await setState(state);
        sendResponse({ ok: false, error: state.last_error });
        return;
      }

      const stepId = crypto.randomUUID();

      const upload = await guideApi({
        action: "upload_screenshot",
        guide_id: state.guide.id,
        step_id: stepId,
        data_url: screenshot
      });

      const label =
        message.element?.label ||
        "the highlighted control";

      state.steps.push({
        id: stepId,
        title:
          message.title ||
          ("Step " + (state.steps.length + 1)),
        instruction:
          message.instruction ||
          ("Select " + label + "."),
        url:
          message.url ||
          sender.tab.url ||
          "",
        page_title:
          message.page_title ||
          sender.tab.title ||
          "",
        element: message.element || {},
        click: message.click || {
          x_pct: 50,
          y_pct: 50
        },
        screenshot_path: upload.path,
        screenshot_url: upload.url || null,
        captured_at: new Date().toISOString()
      });

      await setState(state);
      await saveGuide(state);

      sendResponse({
        ok: true,
        count: state.steps.length,
        guide_id: state.guide.id
      });
      return;
    }

    if (message?.type === "OPEN_GUIDE") {
      const state = await getState();

      if (!state.guide?.id) {
        throw new Error("No guide is currently recorded.");
      }

      await chrome.tabs.create({
        url:
          "https://guides.screenings4u.com/editor.html?id=" +
          encodeURIComponent(state.guide.id)
      });

      sendResponse({ ok: true });
      return;
    }

    sendResponse({
      ok: false,
      error: "Unknown recorder action."
    });
  })().catch(error => {
    sendResponse({
      ok: false,
      error: error?.message || String(error)
    });
  });

  return true;
});