export {};

declare global {
  type CaretPosition = {
    offsetNode: Node;
    offset: number;
  };

  interface Document {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
    caretPositionFromPoint?: (x: number, y: number) => CaretPosition | null;
  }
}
