require("dotenv").config();

const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const path = require("path");

const app = express();

app.set("view engine", "ejs");
app.set("views", path.resolve(__dirname, "./views"));
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

app.post("/", async (req, res) => {
  try {
    const userData = req.body;
    const { data, response: tokenResponse } = await createSessionToken(userData, userData?.scope);
    
    if (tokenResponse.ok) {
      res.status(200).json({ data });
    } else {
      res.status(400).json({ message: data?.message });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
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

// Endpoint to serve Travel SDK initialization with iPhone mockup
app.get("/travel", async (req, res) => {
  const {
    session_token,
    authToken,
    path,
    start_date,
    end_date,
    lat,
    lng,
    loc,
  } = req.query;

  let sessionToken = session_token;

  // If session_token is not provided, generate one from authToken
  if (!sessionToken && authToken) {
    let userData = await getUserData(authToken);
    sessionToken = await getSessionToken(userData);
  }

  // Build webview URL with session token
  const webviewUrl = `/webview?session_token=${encodeURIComponent(sessionToken || '')}${authToken ? '&authToken=' + encodeURIComponent(authToken) : ''}`;

  // Serve an HTML page with iPhone mockup containing iframe
  res.render("home", {
    webviewUrl: webviewUrl,
  });
});

app.all(/.*/, (req, res) => {
  res
    .status(404)
    .json({ message: "Invalid endpoint. Please contact the admin." });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

