self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const existingWindow = windows.find((windowClient) =>
        windowClient.url.startsWith(self.location.origin)
      );
      if (existingWindow) return existingWindow.focus();
      return clients.openWindow("/");
    })
  );
});
