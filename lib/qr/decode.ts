// Robust QR decoding via the full ZXing-C++ engine compiled to WASM.
//
// Why not html5-qrcode's built-in decoder? On iOS Safari there is no native
// BarcodeDetector, so html5-qrcode falls back to a weak pure-JS decoder that
// CANNOT read FCU's clock-in QR — it encodes a ~285-char JWT, producing a
// high-density (v13+) QR that the JS decoder fails on for both live frames and
// still photos. ZXing-WASM with tryHarder decodes the exact same on-screen QR
// reliably (verified against a real iPhone capture), so we route every decode
// through here instead.
//
// The .wasm is self-hosted from /public/zxing (see scripts/copy step / repo)
// rather than the default jsDelivr CDN, so scanning never depends on a third
// party being reachable.
import {
  prepareZXingModule,
  readBarcodesFromImageData,
  readBarcodesFromImageFile,
  type ReaderOptions,
} from 'zxing-wasm/reader';

// A single, stable overrides object. prepareZXingModule() uses shallow equality
// on `overrides` to decide whether to reuse the already-loaded module — so every
// call MUST pass this exact reference, otherwise a later call (e.g. warmup) is
// treated as a new config and the locateFile override is lost (falling back to
// the CDN).
const MODULE_OVERRIDES = {
  locateFile: (path: string, prefix: string) =>
    path.endsWith('.wasm') ? '/zxing/zxing_reader.wasm' : prefix + path,
};

let configured = false;
function ensureConfigured() {
  if (configured) return;
  configured = true;
  prepareZXingModule({ overrides: MODULE_OVERRIDES });
}

// tryHarder / tryRotate / tryInvert are the defaults that make a glary,
// slightly-rotated screen QR decodable. We pin QRCode-only so the engine never
// wastes effort on other symbologies.
const READER_OPTS: ReaderOptions = {
  formats: ['QRCode'],
  tryHarder: true,
  tryRotate: true,
  tryInvert: true,
  tryDownscale: true,
  maxNumberOfSymbols: 1,
};

// Decode a still photo (the hero "拍照打卡" path). A high-res capture off a
// monitor decodes far more reliably than the live stream.
export async function decodeImageFile(file: Blob): Promise<string | null> {
  ensureConfigured();
  const results = await readBarcodesFromImageFile(file, READER_OPTS);
  return results.find((r) => r.text)?.text ?? null;
}

// Decode a single live-video frame (sampled to a canvas → ImageData).
export async function decodeImageData(data: ImageData): Promise<string | null> {
  ensureConfigured();
  const results = await readBarcodesFromImageData(data, READER_OPTS);
  return results.find((r) => r.text)?.text ?? null;
}

// Kick off the ~940KB wasm fetch+compile early (e.g. on the preflight screen)
// so the first real decode isn't blocked on it.
export function warmupDecoder(): void {
  ensureConfigured();
  prepareZXingModule({ overrides: MODULE_OVERRIDES, fireImmediately: true }).catch(
    () => {},
  );
}
