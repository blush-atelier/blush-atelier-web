import { useState } from 'react';
import type { Product } from '../../domain/contracts';
import { productImagery } from '../product-imagery';
export const imageSmall = '/images/atelier-720.jpg';
export const imageLarge = '/images/atelier-1440.jpg';
function safeRemote(url: string | null): string | null {
  if (!url) return null;
  try {
    const value = new URL(url);
    return value.protocol === 'https:' || value.protocol === 'http:'
      ? url
      : null;
  } catch {
    return null;
  }
}
export function ProductArt({
  product,
  priority = false,
}: {
  product: Product;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(0);
  const asset = productImagery[product.sku];
  const remote = safeRemote(product.imageUrl);
  const legacy =
    product.sku === 'BLUSH-ROSE-01'
      ? 'rose'
      : product.sku === 'LIP-COCOA-01'
        ? 'cocoa'
        : 'atelier';
  const local = asset
    ? `/images/catalog/${asset}-480.jpg`
    : `/images/${legacy}-720.jpg`;
  const large = asset
    ? `/images/catalog/${asset}-960.jpg`
    : `/images/${legacy}-1440.jpg`;
  const sources = asset
    ? [local, ...(remote ? [remote] : [])]
    : [...(remote ? [remote] : []), local];
  const current = sources[failed];
  return (
    <div
      className={`product-art ${asset ? 'product-art--packshot' : `product-art--${legacy}`}`}
    >
      {!current ? (
        <div
          className="art-fallback"
          role="img"
          aria-label={`Imagen no disponible: ${product.name}`}
        >
          <span>blush</span>
          <small>ATELIER</small>
        </div>
      ) : (
        <img
          src={current}
          srcSet={
            current === local
              ? `${local} ${asset ? 480 : 720}w, ${large} ${asset ? 960 : 1440}w`
              : undefined
          }
          sizes={
            priority
              ? '(min-width: 900px) 50vw, 100vw'
              : '(min-width: 1200px) 290px, (min-width: 600px) 32vw, 50vw'
          }
          width={asset ? 480 : 720}
          height={asset ? 480 : legacy === 'atelier' ? 480 : 720}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          alt={
            asset
              ? product.name
              : `${product.name}, imagen ilustrativa de la colección`
          }
          onError={() => setFailed((value) => value + 1)}
        />
      )}
    </div>
  );
}
