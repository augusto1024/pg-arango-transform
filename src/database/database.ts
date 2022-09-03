export class MigrationDatabase {
  protected notify: (message: TransformMessage) => void;

  constructor(notify?: (message: TransformMessage) => void) {
    this.notify = notify
      ? notify
      : (message: TransformMessage) => undefined;
  }
}
