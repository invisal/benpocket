import { create } from 'zustand';
import { Annotation } from '@screen-studio/types/project';
interface AnnotationsStoreState {
  annotations: Annotation[];
  addAnnotation: (annotation: Annotation) => void;
  removeAnnotation: (id: string) => void;
}

export const useAnnotationsStore = create<AnnotationsStoreState>((set) => ({
  annotations: [],
  addAnnotation: (annotation) =>
    set((state) => ({ annotations: [...state.annotations, annotation] })),
  removeAnnotation: (id) =>
    set((state) => ({ annotations: state.annotations.filter((a) => a.id !== id) }))
}));
