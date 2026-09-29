import { createObjectStorage } from "./storage/index.js";
import type { ObjectStorage } from "./storage/object-storage.js";
import { db } from "./db/client.js";
import { createMediaRepository } from "./db/repositories/media.repository.js";
import { createVariantRepository } from "./db/repositories/variant.repository.js";
import {
  createProcessingJobRepository,
  createUploadRepository,
} from "./db/repositories/upload.repository.js";
import { createEventRepository } from "./db/repositories/event.repository.js";
import { MediaService } from "./services/media.service.js";
import { UploadService } from "./services/upload.service.js";
import { ProcessingService } from "./services/processing.service.js";
import { AdminService } from "./services/admin.service.js";

/**
 * Composition root. Storage is created once behind the ObjectStorage
 * interface; repositories and services are wired here so routes/handlers
 * never construct dependencies themselves.
 */
export interface ServiceContainer {
  storage: ObjectStorage;
  mediaService: MediaService;
  uploadService: UploadService;
  processingService: ProcessingService;
  adminService: AdminService;
  /** Direct repository access for workers (cleanup/purge paths). */
  repos: {
    media: ReturnType<typeof createMediaRepository>;
    variants: ReturnType<typeof createVariantRepository>;
    uploads: ReturnType<typeof createUploadRepository>;
    jobs: ReturnType<typeof createProcessingJobRepository>;
    events: ReturnType<typeof createEventRepository>;
  };
}

let container: ServiceContainer | null = null;

export function getServiceContainer(): ServiceContainer {
  if (container) return container;

  const storage = createObjectStorage();
  const repos = {
    media: createMediaRepository(db),
    variants: createVariantRepository(db),
    uploads: createUploadRepository(db),
    jobs: createProcessingJobRepository(db),
    events: createEventRepository(db),
  };

  const mediaService = new MediaService(storage, {
    media: repos.media,
    variants: repos.variants,
  });
  const uploadService = new UploadService(storage, repos, mediaService);
  const processingService = new ProcessingService(storage, {
    media: repos.media,
    variants: repos.variants,
  });
  const adminService = new AdminService(storage, {
    media: repos.media,
    variants: repos.variants,
    jobs: repos.jobs,
  });

  container = {
    storage,
    mediaService,
    uploadService,
    processingService,
    adminService,
    repos,
  };
  return container;
}

/** Test seam: allows injecting an in-memory storage provider. */
export function setServiceContainerForTests(override: ServiceContainer): void {
  container = override;
}
