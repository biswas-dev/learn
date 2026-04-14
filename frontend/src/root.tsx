import { component$ } from "@builder.io/qwik";
import {
  QwikCityProvider,
  RouterOutlet,
  ServiceWorkerRegister,
} from "@builder.io/qwik-city";

import "./global.css";

export default component$(() => {
  return (
    <QwikCityProvider>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg?v=1" />
        <title>Learn — Course Platform</title>
        <ServiceWorkerRegister />
      </head>
      <body class="bg-surface text-text min-h-screen antialiased">
        <RouterOutlet />
      </body>
    </QwikCityProvider>
  );
});
