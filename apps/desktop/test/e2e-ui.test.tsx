// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { MockPlatformAdapter, setPlatformAdapter } from '../src/platform';
import { useThemeStore } from '../src/state/themeStore';
import { useSourceStore } from '../src/state/sourceStore';
import { useExportStore } from '../src/state/exportStore';
import App from '../src/App';

if (typeof Blob !== 'undefined' && !Blob.prototype.arrayBuffer) {
  Blob.prototype.arrayBuffer = async function (this: Blob): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this);
    });
  };
}

const ASSETS_DIR = path.resolve(
  import.meta.dirname,
  '../../../../assets-for-testing-purpose'
);

describe('End-to-End Real-World Sample UI Integration', () => {
  let mockAdapter: MockPlatformAdapter;
  let izyBytes: Uint8Array;
  let facadeBytes: Uint8Array;

  beforeEach(async () => {
    mockAdapter = new MockPlatformAdapter();
    setPlatformAdapter(mockAdapter);

    // Read real fixtures from disk
    const izyPath = path.resolve(ASSETS_DIR, 'IZY-original.pro');
    const facadePath = path.resolve(ASSETS_DIR, 'façade.vpc');

    izyBytes = new Uint8Array(fs.readFileSync(izyPath));
    facadeBytes = new Uint8Array(fs.readFileSync(facadePath));

    // Mount fixtures in mock in-memory filesystem
    await mockAdapter.writeFile('/samples/IZY-original.pro', izyBytes);
    await mockAdapter.writeFile('/samples/façade.vpc', facadeBytes);

    // Reset stores
    useThemeStore.getState().setTheme('light');
    useSourceStore.getState().clearAll();
    useExportStore.setState({
      targetFormat: 'txt',
      outputDirectory: '/output/e2e',
      collisionPolicy: 'rename',
      combineMode: false,
      combineName: '',
      libraryName: '',
      isExporting: false,
      progress: { current: 0, total: 0, message: '' },
      lastSummary: null,
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('loads real-world ProPresenter and VideoPsalm files, displays ReviewWorkspace, switches songs, and exports', async () => {
    // 1. Render main desktop Application
    render(<App />);

    // Initially shows empty state in ReviewWorkspace
    expect(
      screen.getByText(/drop presentation files to get started/i)
    ).toBeDefined();

    // 2. Add real-world sample files to sourceStore via adapter.addFiles
    await act(async () => {
      await useSourceStore
        .getState()
        .addFiles(
          ['/samples/IZY-original.pro', '/samples/façade.vpc'],
          mockAdapter
        );
    });

    // 3. Verify SourcesSidebar lists both imported sources
    expect(screen.getByText('IZY-original.pro')).toBeDefined();
    expect(screen.getByText('façade.vpc')).toBeDefined();
    // façade.vpc contains 19 songs
    expect(screen.getByText('19')).toBeDefined();

    // 4. Verify ReviewWorkspace renders active song "IZY"
    const titleInput = screen.getByRole('textbox', {
      name: /song title/i,
    }) as HTMLInputElement;
    expect(titleInput.value).toBe('IZY');

    // Metadata cards/labels (Author, CCLI, Copyright)
    expect(screen.getByText(/Author:/i)).toBeDefined();
    expect(screen.getByText(/CCLI:/i)).toBeDefined();
    expect(screen.getByText(/Copyright:/i)).toBeDefined();

    // Section chips: Verse, Chorus, Tag
    expect(screen.getAllByText('Verse').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Chorus').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Tag').length).toBeGreaterThanOrEqual(1);
    // Section slide counts
    expect(screen.getByText('(12)')).toBeDefined();
    expect(screen.getByText('(2)')).toBeDefined();
    expect(screen.getByText('(3)')).toBeDefined();

    // Verify 17 slide cards with lyric lines rendered
    const slideCards = screen.getAllByText(/^[1-9][0-9]?\/17$/);
    expect(slideCards).toHaveLength(17);

    // Verify lyric line in first slide
    expect(screen.getByText(/Izy mamatsy ahy isan'andro/i)).toBeDefined();

    // Section color dot indicators rendered on slide cards
    const sectionDots = screen.getAllByTestId('slide-section-dot');
    expect(sectionDots.length).toBeGreaterThan(0);
    // Verse section color in IZY-original.pro is #0077cc (rgb(0, 119, 204))
    expect(sectionDots[0]!.style.backgroundColor).toBe('rgb(0, 119, 204)');

    // 5. Switch active song in multi-song accordion to "Mendrika Ianao" from façade.vpc
    const mendrikaSongRow = screen.getByText('Mendrika Ianao');
    expect(mendrikaSongRow).toBeDefined();

    await act(async () => {
      fireEvent.click(mendrikaSongRow);
    });

    // Verify ReviewWorkspace updated to display "Mendrika Ianao"
    expect(
      (
        screen.getByRole('textbox', {
          name: /song title/i,
        }) as HTMLInputElement
      ).value
    ).toBe('Mendrika Ianao');

    // Verify format badge updated to vpc
    expect(screen.getByText('vpc')).toBeDefined();

    // 6. Switch to another song in façade.vpc: "Majesté"
    const majesteSongRow = screen.getByText('Majesté');
    expect(majesteSongRow).toBeDefined();

    await act(async () => {
      fireEvent.click(majesteSongRow);
    });

    expect(
      (
        screen.getByRole('textbox', {
          name: /song title/i,
        }) as HTMLInputElement
      ).value
    ).toBe('Majesté');

    // 7. Configure export in ExportSidebar
    // Target format: Plain Text (.txt)
    const txtFormatBtn = screen.getByRole('button', { name: /plain text/i });
    fireEvent.click(txtFormatBtn);
    expect(useExportStore.getState().targetFormat).toBe('txt');

    // Output directory input
    const outDirInput = screen.getByPlaceholderText('/path/to/output');
    fireEvent.change(outDirInput, { target: { value: '/output/real-export' } });
    expect(useExportStore.getState().outputDirectory).toBe('/output/real-export');

    // Collision policy: Overwrite
    const collisionSelect = screen.getByRole('combobox', {
      name: /collision policy/i,
    });
    fireEvent.change(collisionSelect, { target: { value: 'overwrite' } });
    expect(useExportStore.getState().collisionPolicy).toBe('overwrite');

    // Total songs selected: 1 from IZY + 19 from façade.vpc = 20 songs
    const exportBtn = screen.getByRole('button', {
      name: /export 20 songs/i,
    });
    expect(exportBtn).toBeDefined();
    expect((exportBtn as HTMLButtonElement).disabled).toBe(false);

    // 8. Trigger export through the UI
    await act(async () => {
      fireEvent.click(exportBtn);
    });

    // 9. Verify BatchProgressModal shows completion
    expect(screen.getByText('Export Complete')).toBeDefined();
    expect(screen.getByText(/20 succeeded/i)).toBeDefined();

    // 10. Verify output files exist in mockAdapter in-memory filesystem with non-zero bytes
    expect(await mockAdapter.exists('/output/real-export/IZY.txt')).toBe(true);
    const izyTxtBytes = await mockAdapter.readFile('/output/real-export/IZY.txt');
    expect(izyTxtBytes.length).toBeGreaterThan(0);
    const izyTxtString = new TextDecoder().decode(izyTxtBytes);
    expect(izyTxtString).toContain("Izy mamatsy ahy isan'andro");

    expect(
      await mockAdapter.exists('/output/real-export/Mendrika Ianao.txt')
    ).toBe(true);
    const mendrikaBytes = await mockAdapter.readFile(
      '/output/real-export/Mendrika Ianao.txt'
    );
    expect(mendrikaBytes.length).toBeGreaterThan(0);

    expect(await mockAdapter.exists('/output/real-export/Majesté.txt')).toBe(true);
    const majesteBytes = await mockAdapter.readFile(
      '/output/real-export/Majesté.txt'
    );
    expect(majesteBytes.length).toBeGreaterThan(0);

    // Close modal via modal Close button
    const closeBtns = screen.getAllByRole('button', { name: /close/i });
    const modalCloseBtn = closeBtns.find((b) => b.textContent?.trim() === 'Close') ?? closeBtns[closeBtns.length - 1]!;
    fireEvent.click(modalCloseBtn);
    expect(useExportStore.getState().lastSummary).toBeNull();
  });

  it('triggers file selection via SourcesSidebar Add Files UI button', async () => {
    vi.spyOn(mockAdapter, 'pickFiles').mockResolvedValue([
      '/samples/IZY-original.pro',
    ]);

    render(<App />);

    const addFilesBtn = screen.getByRole('button', { name: /add files/i });
    await act(async () => {
      fireEvent.click(addFilesBtn);
    });

    expect(useSourceStore.getState().sources).toHaveLength(1);
    expect(useSourceStore.getState().sources[0]!.name).toBe('IZY-original.pro');
    expect(
      screen.getByRole('textbox', { name: /song title/i })
    ).toHaveProperty('value', 'IZY');
  });
});
