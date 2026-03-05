'use client'

/**
 * Register the service worker and handle push subscription
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    })
    return registration
  } catch (error) {
    console.error('Service worker registration failed:', error)
    return null
  }
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPush(): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready

    // Get VAPID public key from server
    const res = await fetch('/api/push/vapid')
    if (!res.ok) return false
    const { publicKey } = await res.json()

    if (!publicKey) return false

    // Check if already subscribed
    let subscription = await registration.pushManager.getSubscription()

    if (!subscription) {
      // Subscribe
      const keyArray = urlBase64ToUint8Array(publicKey)
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyArray.buffer as ArrayBuffer,
      })
    }

    // Send subscription to server
    const subJson = subscription.toJSON()
    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subJson.keys?.p256dh,
          auth: subJson.keys?.auth,
        },
      }),
    })

    return response.ok
  } catch (error) {
    console.error('Push subscription failed:', error)
    return false
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()

    if (!subscription) return true

    // Unsubscribe locally
    await subscription.unsubscribe()

    // Notify server
    await fetch('/api/push/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    })

    return true
  } catch (error) {
    console.error('Push unsubscription failed:', error)
    return false
  }
}

/**
 * Check if push notifications are supported and the current permission state
 */
export function getPushPermissionState(): {
  supported: boolean
  permission: NotificationPermission | 'unsupported'
} {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    return { supported: false, permission: 'unsupported' }
  }

  return { supported: true, permission: Notification.permission }
}

/**
 * Check if the user is currently subscribed to push
 */
export async function isPushSubscribed(): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator)) return false
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    return subscription !== null
  } catch {
    return false
  }
}

/**
 * Convert a base64 VAPID key to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
