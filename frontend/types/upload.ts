export type UploadState = 'idle' | 'uploading' | 'review' | 'confirming' | 'done' | 'error';
export type GameType = '4D' | 'TOTO';

export type OcrDraft = {
  gameType: GameType;
  drawDateOptions: string[];
  drawNumberOptions: string[];
  drawNumberByDate: Record<string, string>;
  purchaseDatetime: string;
  betType: string;
  numbersText: string;
  bigAmount: string;
  smallAmount: string;
  totalPrice: string;
  rawText: string;
};

export type ReviewField =
  | 'gameType'
  | 'betType'
  | 'purchaseDatetime'
  | 'numbersText'
  | 'drawDates'
  | 'bigAmount'
  | 'smallAmount';

export type FieldConfidence = 'auto' | 'uncertain';
export type DraftConfidence = Record<ReviewField, FieldConfidence>;
export type FieldErrors = Partial<Record<ReviewField, string>>;
export type FieldTouched = Partial<Record<ReviewField, boolean>>;

export type NumberPreviewRow = {
  key: string;
  text: string;
  isValid: boolean;
};
