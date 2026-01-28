export interface IBaseModelObserver {
  onDelete: (id: number) => Promise<void>;
  onDeleting: (id: number) => Promise<void>;
  onCreate: (id: number) => Promise<void>;
  onCreating: (id: number) => Promise<void>;
}
