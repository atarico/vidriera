/**
 * Single source of every customer-facing string in the storefront.
 *
 * All copy here is neutral, professional Spanish (no voseo, no regional
 * slang) aimed at customers of an Argentine neighbourhood business. Nothing
 * outside this module should hardcode a customer-facing string: change the
 * language, tone, or wording here and it updates everywhere at once.
 *
 * Identifiers and comments stay in English, as required by the project's
 * artifact-language rule; only the string VALUES are Spanish.
 */
export const copy = {
  site: {
    defaultName: 'Catálogo',
    defaultTagline: 'Encontrá lo que buscás y consultá por WhatsApp.',
  },
  nav: {
    home: 'Inicio',
  },
  search: {
    placeholder: 'Buscar productos',
    clearFilters: 'Limpiar filtros',
    resultsCount: (count: number) =>
      count === 1 ? '1 producto encontrado' : `${count} productos encontrados`,
  },
  facets: {
    category: 'Categoría',
    inStock: 'Disponibilidad',
    inStockOnly: 'Solo disponibles',
    showMore: 'Ver más',
    showLess: 'Ver menos',
  },
  states: {
    loading: 'Buscando productos…',
    empty: 'No encontramos productos con estos filtros.',
    emptyHint: 'Probá con otra búsqueda o quitá algún filtro.',
    error: 'No pudimos cargar el catálogo. Intentá nuevamente más tarde.',
    notConfigured: 'El catálogo todavía no está disponible.',
  },
  product: {
    priceUnavailable: 'Precio a consultar',
    outOfStock: 'Sin stock',
    inStock: 'Disponible',
    detailsHeading: 'Detalles',
    backToSearch: 'Volver al catálogo',
    notFoundTitle: 'Producto no encontrado',
    notFoundBody: 'Es posible que ya no esté disponible. Volvé al catálogo para seguir buscando.',
  },
  whatsapp: {
    ctaLabel: 'Consultar por WhatsApp',
    /**
     * The prefilled WhatsApp message. Kept as a single function so the
     * wording is defined exactly once, wherever the link is built.
     */
    orderMessage: (productName: string, productUrl: string): string =>
      `Hola, quiero consultar por "${productName}". ${productUrl}`,
  },
  footer: {
    rights: (year: number, businessName: string) => `© ${year} ${businessName}`,
  },
} as const
