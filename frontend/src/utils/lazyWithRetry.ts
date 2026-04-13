import { lazy, ComponentType } from 'react'

const MAX_RETRIES = 3
const RETRY_DELAY = 1000

export function lazyWithRetry<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  chunkName?: string
): React.LazyExoticComponent<T> {
  return lazy(() => {
    return new Promise<{ default: T }>((resolve, reject) => {
      const attemptImport = (retryCount = 0) => {
        importFunc()
          .then(resolve)
          .catch((error) => {
            if (retryCount < MAX_RETRIES) {
              console.warn(`Failed to load chunk${chunkName ? ` "${chunkName}"` : ''}. Retrying... (${retryCount + 1}/${MAX_RETRIES})`)
              setTimeout(() => {
                attemptImport(retryCount + 1)
              }, RETRY_DELAY * (retryCount + 1))
            } else {
              console.error(`Failed to load chunk${chunkName ? ` "${chunkName}"` : ''} after ${MAX_RETRIES} attempts.`)
              window.location.href = '/error?type=connection'
              reject(error)
            }
          })
      }
      attemptImport()
    })
  })
}
