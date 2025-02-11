// import 'core-js/stable';
// import 'regenerator-runtime/runtime';

import React from "react";
import ReactDOM from "react-dom";
import { BrowserRouter } from "react-router-dom";

// Note: Using an Alias in Webpack
import App from 'components/App/';

// Note: Using an Alias in Webpack
import 'styles/index.scss';

// Note: When upgrading to React 19
import { createRoot } from "react-dom/client";

import * as Sentry from "@sentry/react";
import { BrowserTracing } from "@sentry/tracing";
// Import the Replay integration for session replay.
import { Replay } from "@sentry/replay";

// dsn v1 - "https://df6c5a4eb9a44ea4d59cba874d477138@o4508766797889536.ingest.de.sentry.io/4508766955569232"
// dsn v2 - "https://971ce68febfb7e1009e981eee289c40f@o4508766797889536.ingest.de.sentry.io/4508767058329680"

Sentry.init({
  dsn: "https://971ce68febfb7e1009e981eee289c40f@o4508766797889536.ingest.de.sentry.io/4508767058329680",
  // Tracing.
  integrations: [
    new BrowserTracing(),
    new Replay(), // Explicitly add the Replay integration.
  ],
  tracesSampleRate: 1.0, //  Capture 100% of the transactions
  // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
  tracePropagationTargets: ["localhost", /^https:\/\/yourserver\.io\/api/],
  // Session Replay
  replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
  replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.
});


const rootElement = document.getElementById("root");
const root = createRoot(rootElement);


root.render(
  
  <BrowserRouter>
  
  <App />
	
  </BrowserRouter>


); 

// Note: Before npm run build the statement module.hot.accept(); could / should to be disabled / comment out !!!
// In Webpck HotModuleReplacementPlugin() is used to set hot to true. 
// This way the browser dont need to reload the entire page when changing  file !
// Note: Needed here - in contrast to Vue.js  !!
 if (module.hot) {
    module.hot.accept();
 }

