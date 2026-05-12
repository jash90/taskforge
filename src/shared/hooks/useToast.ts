import { useSyncExternalStore } from 'react'

export type ToastVariant = 'success' | 'error' | 'info'

export interface Toast {
  id: number
  variant: ToastVariant
  title: string
  description?: string
  action?: { label: string; onPress: () => void }
  duration: number
}

type Subscriber = () => void

let nextId = 1
let toasts: Toast[] = []
const subscribers = new Set<Subscriber>()
const timers = new Map<number, ReturnType<typeof setTimeout>>()

const emit = () => {
  toasts = [...toasts]
  subscribers.forEach((fn) => fn())
}

const subscribe = (fn: Subscriber) => {
  subscribers.add(fn)
  return () => subscribers.delete(fn)
}

const getSnapshot = () => toasts

export const dismissToast = (id: number) => {
  const timer = timers.get(id)
  if (timer) {
    clearTimeout(timer)
    timers.delete(id)
  }
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}

interface PushOptions {
  title: string
  description?: string
  duration?: number
  action?: Toast['action']
}

const push = (variant: ToastVariant, opts: PushOptions): number => {
  const id = nextId++
  const duration = opts.duration ?? (variant === 'error' ? 6000 : 4000)
  const toast: Toast = {
    id,
    variant,
    title: opts.title,
    description: opts.description,
    action: opts.action,
    duration,
  }
  toasts = [...toasts, toast]
  emit()
  if (duration > 0) {
    const timer = setTimeout(() => dismissToast(id), duration)
    timers.set(id, timer)
  }
  return id
}

export const toast = {
  success: (opts: PushOptions) => push('success', opts),
  error: (opts: PushOptions) => push('error', opts),
  info: (opts: PushOptions) => push('info', opts),
  dismiss: dismissToast,
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
