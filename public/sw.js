/// <reference lib="webworker" />

const SW_VERSION = '1.0.0'

// Install event - activate immediately
self.addEventListener('install', (event) => {
  self.skipWaiting()
})

// Activate event - claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// Push notification event
self.addEventListener('push', (event) => {
  if (!event.data) return

  let data
  try {
    data = event.data.json()
  } catch {
    data = {
      title: 'Servants Prep',
      body: event.data.text(),
    }
  }

  const options = {
    body: data.body || '',
    icon: '/sp-logo.png',
    badge: '/sp-logo.png',
    tag: data.tag || 'default',
    renotify: true,
    data: {
      url: data.url || '/',
      notificationId: data.notificationId,
    },
    actions: data.actions || [],
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Servants Prep', options)
  )
})

// Notification click event - open/focus the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const url = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it and navigate
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus()
          client.navigate(url)
          return
        }
      }
      // Otherwise open a new window
      return self.clients.openWindow(url)
    })
  )

  // Mark notification as read via API
  if (event.notification.data?.notificationId) {
    fetch(`/api/notifications/${event.notification.data.notificationId}/read`, {
      method: 'PATCH',
    }).catch(() => {
      // Silently fail - notification will be marked read when user views it
    })
  }
})
