import type { PhotoFile } from './types.js'

export const SAMPLE_JPEG_BASE64 =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAAQABADASIAAhEBAxEB/8QAFwABAQEBAAAAAAAAAAAAAAAAAAECBf/EAB0QAAICAgMBAAAAAAAAAAAAAAABAhEDIRIxQVH/xAAVAQEBAAAAAAAAAAAAAAAAAAABAP/EABYRAQEBAAAAAAAAAAAAAAAAAAARAf/aAAwDAQACEQMRAD8A7+uZVq2oU2kQlU5t3Dq0m9mKZbZqQX1s4nqK2Wc2E2s7XKx0mC1EwABAAf/9k='

export const SAMPLE_PHOTO_FIXTURE = {
  path: 'mock://chimera-camera/sample-photo.jpg',
  width: 16,
  height: 16,
  orientation: 'up',
  mime: 'image/jpeg',
  base64: SAMPLE_JPEG_BASE64,
} as const satisfies PhotoFile
