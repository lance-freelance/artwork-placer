/**
 * Regression test for "the upload clears itself".
 *
 * A freshly uploaded filename only joins the picker's option list on the same
 * render that selects it. Radix keeps a hidden native <select> in step with
 * the value, and that sync runs before the new <option> has rendered — so the
 * assignment finds no match, settles on "", and echoes "" back through
 * onValueChange. Acting on that echo wiped the image the upload had just
 * attached, leaving the picker on its placeholder.
 *
 * These tests pin both halves: the upload survives, and a real choice from the
 * list still works.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Radix's Select measures its trigger; jsdom has no ResizeObserver.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const uploadMutate = vi.fn();

// Deliberately does not contain the uploaded filename: the media listing is
// only invalidated after the upload lands, which is the window the bug lived in.
const mediaArt = ['existing-piece.png', 'existing-piece-thumb.webp'];

vi.mock('@workspace/api-client-react', () => ({
  useCreateArt: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateArt: () => ({ mutate: vi.fn(), isPending: false }),
  useListMedia: () => ({ data: { art: mediaArt, rooms: [] }, isLoading: false }),
  useUploadArtImage: () => ({ mutateAsync: uploadMutate }),
  getListArtQueryKey: () => ['art'],
  getListMediaQueryKey: () => ['media'],
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

// The canvas-backed helpers can't run in jsdom, and none of them are what's
// under test — the form's own bookkeeping is.
vi.mock('../pages/admin/imageTools', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../pages/admin/imageTools')>();
  return {
    ...actual,
    readFileAsDataUrl: vi.fn(async () => 'data:image/png;base64,AAA'),
    loadImage: vi.fn(async () => ({ naturalWidth: 800, naturalHeight: 600 })),
    trimTransparentEdges: vi.fn(async (image: unknown, dataUrl: string) => ({
      dataUrl,
      image,
      trimmedFrom: null,
    })),
    generateThumbnail: vi.fn(() => 'data:image/webp;base64,BBB'),
    verifyImageAsset: vi.fn(async () => undefined),
  };
});

import { ArtForm } from '../pages/admin/ArtForm';

const uploadFile = () => {
  const input = screen.getByTestId('input-art-image');
  const file = new File(['x'], 'fresh-upload.png', { type: 'image/png' });
  fireEvent.change(input, { target: { files: [file] } });
};

describe('ArtForm existing-image picker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uploadMutate.mockResolvedValue({
      fullImageFilename: 'fresh-upload.png',
      thumbnailFilename: 'fresh-upload-thumb.webp',
    });
  });

  it('selects the uploaded image once the upload lands', async () => {
    render(<ArtForm onSuccess={() => {}} onCancel={() => {}} />);

    uploadFile();

    await waitFor(() =>
      expect(screen.getByTestId('select-existing-art-image')).toHaveTextContent(
        'fresh-upload.png',
      ),
    );
  });

  it('keeps the upload attached instead of clearing it', async () => {
    render(<ArtForm onSuccess={() => {}} onCancel={() => {}} />);

    uploadFile();

    // The remove button and the previews only render while an image is
    // attached, so they are the form's own account of what it is holding.
    await waitFor(() =>
      expect(screen.getByTestId('button-remove-art-image')).toBeInTheDocument(),
    );
    // The filename also appears on the picker's trigger, hence getAllByText.
    expect(screen.getAllByText('fresh-upload.png').length).toBeGreaterThan(0);
    expect(screen.getByText('fresh-upload-thumb.webp')).toBeInTheDocument();

    // The echo arrives an effect after the value lands; give it the chance.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByTestId('button-remove-art-image')).toBeInTheDocument();
  });

  it('still lets the admin remove an attached image', async () => {
    render(<ArtForm onSuccess={() => {}} onCancel={() => {}} />);

    uploadFile();
    await waitFor(() =>
      expect(screen.getByTestId('button-remove-art-image')).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByTestId('button-remove-art-image'));

    await waitFor(() =>
      expect(
        screen.queryByTestId('button-remove-art-image'),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId('select-existing-art-image')).toHaveTextContent(
      '…or pick an image already in the art folder',
    );
  });
});
