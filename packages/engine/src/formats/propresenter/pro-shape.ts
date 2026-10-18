/**
 * Minimal structural view of the decoded ProPresenter 7 Presentation
 * protobuf. Only the fields the importer reads are modeled; everything
 * else is intentionally ignored.
 */

export interface ProUuid {
  string?: string | null;
}

export interface ProTextElement {
  element?: {
    uuid?: ProUuid | null;
    name?: string | null;
    text?: {
      rtfData?: Uint8Array | string | null;
    } | null;
  } | null;
}

export interface ProBaseSlide {
  uuid?: ProUuid | null;
  elements?: ProTextElement[] | null;
}

export interface ProAction {
  uuid?: ProUuid | null;
  slide?: {
    presentation?: {
      baseSlide?: ProBaseSlide | null;
    } | null;
  } | null;
}

export interface ProCue {
  uuid?: ProUuid | null;
  name?: string | null;
  actions?: ProAction[] | null;
}

export interface ProColor {
  red?: number | null;
  green?: number | null;
  blue?: number | null;
  alpha?: number | null;
}

export interface ProGroup {
  group?: {
    uuid?: ProUuid | null;
    name?: string | null;
    color?: ProColor | null;
  } | null;
  cueIdentifiers?: ProUuid[] | null;
}

export interface ProArrangement {
  uuid?: ProUuid | null;
  name?: string | null;
  groupIdentifiers?: ProUuid[] | null;
}

export interface ProCcli {
  author?: string | null;
  songTitle?: string | null;
  copyrightYear?: number | null;
  songNumber?: number | null;
}

export interface ProPresentation {
  name?: string | null;
  notes?: string | null;
  category?: string | null;
  ccli?: ProCcli | null;
  cues?: ProCue[] | null;
  cueGroups?: ProGroup[] | null;
  arrangements?: ProArrangement[] | null;
  selectedArrangement?: ProUuid | null;
}
