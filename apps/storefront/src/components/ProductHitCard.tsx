import type { CatalogRecord } from '@vidriera/contracts'
import { pickRendition } from '../lib/images'
import { formatPrice } from '../lib/price'
import { copy } from '../lib/copy'

export interface ProductHitCardProps {
  hit: CatalogRecord
}

/** The Hits card rendered by react-instantsearch's hitComponent prop. */
export function ProductHitCard({ hit }: ProductHitCardProps) {
  const cardImage = pickRendition(hit.images, 'card')

  return (
    <a className="product-card" href={`/productos/${hit.slug}/`}>
      <div className="product-card__media">
        {cardImage ? <img src={cardImage} alt={hit.name} loading="lazy" decoding="async" /> : null}
      </div>
      <div className="product-card__body">
        <p className="product-card__name">{hit.name}</p>
        <span className={`product-card__stock${hit.inStock ? '' : ' product-card__stock--out'}`}>
          {hit.inStock ? copy.product.inStock : copy.product.outOfStock}
        </span>
        <p className="product-card__price">{formatPrice(hit.price, hit.currency)}</p>
      </div>
    </a>
  )
}
