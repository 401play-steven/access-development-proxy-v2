require("dotenv").config();

const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const path = require("path");

const app = express();

app.set("view engine", "ejs");
app.set("views", path.resolve(__dirname, "./views"));
app.use(express.static(path.resolve(__dirname, "../public")));
app.use(morgan("dev"));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const createSessionToken = async (userData, scope = "travel") => {
  let response = await fetch(`${process.env.BASE_URL}/api/v1/tokens`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + process.env.API_KEY,
    },
    body: JSON.stringify({
      member_key: userData?.access_member_key || userData?.member_key,
      email: userData?.email,
      first_name: userData?._user_profile?.first_name || userData?.first_name,
      last_name: userData?._user_profile?.last_name || userData?.last_name,
      scope: userData?.scope || scope,
    }),
  });
  const data = await response.json();
  return { data, response };
};

const getSessionToken = async (userData, scope = "travel") => {
  const { data } = await createSessionToken(userData, scope);
  return data?.session_token;
};

const getUserData = async (authToken) => {
  let response = await fetch(
    "https://xpsk-wwpe-6ste.n7d.xano.io/api:2-AkBwJd/auth/me",
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: authToken,
      },
    }
  );
  const data = await response.json();
  return data;
};

app.post("/get_session_token", async (req, res) => {
  try {
    const userData = req.body;

    // ---- VALIDATION (recommended) ----
    if (!userData?.member_key && !userData?.access_member_key) {
      return res.status(400).json({
        message: "member_key is required to generate a session token.",
      });
    }

    // ---- ENFORCE SERVER-CONTROLLED SCOPE ----
    const scope = "travel"; // Always enforce this here

    const { data, response: tokenResponse } =
      await createSessionToken(userData, scope);

    if (tokenResponse.ok) {
      return res.status(200).json({ data });
    }

    return res.status(400).json({ message: data?.message || "Token request failed" });

  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// Endpoint for webview content (loaded in iframe)
app.get("/webview", async (req, res) => {
  const {
    session_token,
    authToken,
  } = req.query;

  let sessionToken = session_token;

  // If session_token is not provided, generate one from authToken
  if (!sessionToken && authToken) {
    let userData = await getUserData(authToken);
    sessionToken = await getSessionToken(userData);
  }

  // Serve the webview page with Travel SDK
  res.render("webview", {
    token: sessionToken,
    scriptUrl: process.env.SCRIPT_URL,
  });
});

// Webview for My Trips
app.get("/webview-my-trips", async (req, res) => {
  const { session_token, authToken } = req.query;

  let sessionToken = session_token;

  if (!sessionToken && authToken) {
    const userData = await getUserData(authToken);
    sessionToken = await getSessionToken(userData);
  }

  res.render("webview-my-trips", {
    token: sessionToken,
    scriptUrl: process.env.SCRIPT_URL,
  });
});

// Webview for My Trips
app.get("/webview-car-search", async (req, res) => {
  const { session_token, authToken } = req.query;

  let sessionToken = session_token;

  if (!sessionToken && authToken) {
    const userData = await getUserData(authToken);
    sessionToken = await getSessionToken(userData);
  }

  res.render("webview-car-search", {
    token: sessionToken,
    scriptUrl: process.env.SCRIPT_URL,
  });
});

// Endpoint to serve Travel SDK initialization with iPhone mockup
app.get("/travel/framed", (req, res) => {
  const { session_token } = req.query;

  if (!session_token) {
    return res.status(400).send("Missing session_token");
  }

  const webviewUrl = `/webview?session_token=${encodeURIComponent(session_token)}`;

  res.render("frame", {
    webviewUrl,
  });
});

// FOR TEST TO MY TRIPS
app.get("/travel/framed/my-trips", (req, res) => {

  console.log("YOU ARE HERE!!!!!!!")
  const { session_token } = req.query;

  if (!session_token) {
    return res.status(400).send("Missing session_token");
  }

  const webviewUrl = `/webview-my-trips?session_token=${encodeURIComponent(session_token)}`;

  res.render("frame", {
    webviewUrl,
  });
});

// FOR TEST TO MY TRIPS
app.get("/travel/framed/car-search", (req, res) => {

  console.log("YOU ARE HERE!!!!!!!")
  const { session_token } = req.query;

  if (!session_token) {
    return res.status(400).send("Missing session_token");
  }

  const webviewUrl = `/webview-car-search?session_token=${encodeURIComponent(session_token)}`;

  res.render("frame", {
    webviewUrl,
  });
});

app.all(/.*/, (req, res) => {
  res
    .status(401)
    .json({ message: "Credentials are required to access this resource." });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

