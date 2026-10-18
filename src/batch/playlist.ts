import { randomUUID } from '../canonical/id.js';
import { getProtoRoot } from '../formats/propresenter/root.js';

export interface PlaylistPresentationEntry {
  title: string;
  uuid: string;
  relativePath: string;
}

/**
 * Generate a ProPresenter 7 binary protobuf playlist (.proplaylist).
 *
 * @param name - Display name of the playlist
 * @param presentations - List of presentation references to include
 * @returns Serialized protobuf Uint8Array matching rv.data.Playlist
 */
export function generateProPlaylist(
  name: string,
  presentations: PlaylistPresentationEntry[]
): Uint8Array {
  const root = getProtoRoot();
  const PlaylistType = root.lookupType('Playlist');

  const items = presentations.map((p) => {
    return {
      uuid: { string: p.uuid ? p.uuid : randomUUID() },
      name: p.title,
      type: 1,
      presentation: {
        documentPath: {
          relativePath: p.relativePath.replace(/\\/g, '/'),
        },
        contentDestination: 1,
      },
    };
  });

  const playlistObj = {
    uuid: { string: randomUUID() },
    name,
    type: 1,
    expanded: true,
    items: {
      items,
    },
  };

  const message = PlaylistType.create(playlistObj);
  return PlaylistType.encode(message).finish();
}
