import type { FormatId } from '@skeuos-labs/mizmor';

export function formatSourceFormatLabel(fmt: FormatId | string): string {
  switch (fmt.toLowerCase()) {
    case 'pro':
      return 'ProPresenter 7 (.pro)';
    case 'pro6':
      return 'ProPresenter 6 (.pro6)';
    case 'vpc':
      return 'VideoPsalm (.vpc)';
    case 'json':
      return 'VideoPsalm JSON (.json)';
    case 'show':
    case 'freeshow':
      return 'FreeShow (.show)';
    case 'txt':
      return 'Plain Text (.txt)';
    case 'pptx':
      return 'PowerPoint (.pptx)';
    default:
      return fmt.toUpperCase();
  }
}

