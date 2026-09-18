self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {
      title: "BrevetTrack",
      body: event.data ? event.data.text() : "Tu as une notification."
    };
  }

  const title = data.title || "BrevetTrack";

  const options = {
    body: data.body || "Tu as une nouvelle notification.",
    icon: data.icon || "/icon-192.png",
    badge: data.badge || "/icon-192.png",
    data: {
      url: data.url || "/"
    },
    tag: data.tag || "brevettrack-notification",
    renotify: true
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({
      type: "window",
      includeUncontrolled: true
    }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});