self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? "Your journal is waiting 🌱", {
      body: data.body ?? "Take a quiet moment to write today’s journal.",
      icon: "/web-app-manifest-192x192.png",
      badge: "/web-app-manifest-192x192.png",
      tag: "daily-journal-reminder",
      data: { url: data.url ?? "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destination = new URL(event.notification.data?.url ?? "/", self.location.origin).href;
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const existingWindow = windows.find((windowClient) =>
        windowClient.url.startsWith(self.location.origin)
      );
      if (existingWindow) {
        return existingWindow.navigate(destination).then((client) => client?.focus());
      }
      return clients.openWindow(destination);
    })
  );
});
