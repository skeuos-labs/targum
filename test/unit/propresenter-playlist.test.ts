import { describe, expect, it } from 'vitest';
import {
  generateProPlaylist,
  type PlaylistPresentationEntry,
} from '../../src/batch/playlist.js';
import { getProtoRoot } from '../../src/formats/propresenter/root.js';

describe('ProPresenter .proplaylist Protobuf Generator', () => {
  it('encodes playlist with 3 songs producing non-empty Uint8Array', () => {
    const presentations: PlaylistPresentationEntry[] = [
      {
        title: 'Amazing Grace',
        uuid: '11111111-1111-1111-1111-111111111111',
        relativePath: 'Amazing Grace.pro',
      },
      {
        title: 'How Great Thou Art',
        uuid: '22222222-2222-2222-2222-222222222222',
        relativePath: 'How Great Thou Art.pro',
      },
      {
        title: '10,000 Reasons',
        uuid: '33333333-3333-3333-3333-333333333333',
        relativePath: '10,000 Reasons.pro',
      },
    ];

    const bytes = generateProPlaylist('Sunday Worship', presentations);

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('decodes raw bytes and verifies playlist and item schema fidelity', () => {
    const presentations: PlaylistPresentationEntry[] = [
      {
        title: 'Song One',
        uuid: 'aaaa-1111',
        relativePath: 'Song One.pro',
      },
      {
        title: 'Song Two',
        uuid: 'bbbb-2222',
        relativePath: 'Song Two.pro',
      },
      {
        title: 'Song Three',
        uuid: 'cccc-3333',
        relativePath: 'Song Three.pro',
      },
    ];

    const bytes = generateProPlaylist('Morning Service', presentations);
    const PlaylistType = getProtoRoot().lookupType('Playlist');
    const decoded = PlaylistType.decode(bytes) as any;
    const decodedObj = PlaylistType.toObject(decoded, {
      enums: String,
      defaults: true,
    }) as any;

    expect(decoded.name).toBe('Morning Service');
    // type is TYPE_PLAYLIST (1)
    expect(decoded.type === 1 || decoded.type === 'TYPE_PLAYLIST').toBe(true);
    expect(decodedObj.type).toBe('TYPE_PLAYLIST');

    expect(decoded.uuid?.string).toBeDefined();
    expect(decoded.uuid.string.length).toBeGreaterThan(0);
    expect(decoded.expanded).toBe(true);

    // items check
    expect(decoded.items?.items).toBeDefined();
    expect(decoded.items.items.length).toBe(3);

    for (let i = 0; i < presentations.length; i++) {
      const item = decoded.items.items[i];
      const expected = presentations[i];

      expect(item.name).toBe(expected.title);
      expect(item.uuid?.string).toBe(expected.uuid);
      expect(item.presentation).toBeDefined();
      expect(item.presentation.documentPath?.relativePath).toBe(
        expected.relativePath
      );
      // ItemType oneof resolves to presentation
      expect(item.ItemType).toBe('presentation');
    }
  });

  it('encodes empty presentations list into valid empty playlist', () => {
    const bytes = generateProPlaylist('Empty Service', []);

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);

    const PlaylistType = getProtoRoot().lookupType('Playlist');
    const decoded = PlaylistType.decode(bytes) as any;

    expect(decoded.name).toBe('Empty Service');
    expect(decoded.type === 1 || decoded.type === 'TYPE_PLAYLIST').toBe(true);
    expect(decoded.items?.items).toBeDefined();
    expect(decoded.items.items.length).toBe(0);
  });

  it('generates random UUID when presentation entry uuid is empty', () => {
    const presentations: PlaylistPresentationEntry[] = [
      {
        title: 'No UUID Song',
        uuid: '',
        relativePath: 'No UUID Song.pro',
      },
    ];

    const bytes = generateProPlaylist('Fallback UUID Playlist', presentations);
    const PlaylistType = getProtoRoot().lookupType('Playlist');
    const decoded = PlaylistType.decode(bytes) as any;

    expect(decoded.items.items[0].uuid?.string).toBeDefined();
    expect(decoded.items.items[0].uuid.string.length).toBeGreaterThan(0);
  });
});
