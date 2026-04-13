/**
 * Library Configuration — Environment-based settings for library identity.
 * Change these values to customize for your library.
 */

export const LIBRARY_NAME = import.meta.env.VITE_LIBRARY_NAME || 'Library'
export const DOWNLOAD_FILENAME = import.meta.env.VITE_DOWNLOAD_FILENAME || 'library_statistics'
